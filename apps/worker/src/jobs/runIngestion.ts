import { buildBusinessContext } from "@/apps/api/src/services/buildBusinessContext";
import { discoverPages } from "@/apps/api/src/services/discoverPages";
import { extractBrandSignals } from "@/apps/api/src/services/extractors/brand";
import { extractContactSignals } from "@/apps/api/src/services/extractors/contact";
import { extractMetadataSignals } from "@/apps/api/src/services/extractors/metadata";
import { extractOfferingSignals } from "@/apps/api/src/services/extractors/offerings";
import { needsRender, fetchPage } from "@/apps/api/src/services/fetchPage";
import { generateDeploymentPackage } from "@/apps/api/src/services/generateDeploymentPackage";
import type { PageAnalysis } from "@/apps/api/src/services/ingestionTypes";
import { renderPage } from "@/apps/api/src/services/renderPage";
import { recommendAgentType } from "@/apps/api/src/services/recommendAgentType";
import {
  getIngestionJob,
  saveBusinessProfile,
  saveCrawledPage,
  saveRawArtifact,
  updateIngestionStatus
} from "@/apps/api/src/services/storage";
import { ensureSafeTarget } from "@/apps/api/src/services/urlSafety";

function isUserVisibleWarning(warning: string) {
  return !/^Rendered fallback used for /i.test(warning) && !/^Redirected from /i.test(warning);
}

function appendWarnings(target: string[], warnings: string[]) {
  for (const warning of warnings) {
    if (!warning || !isUserVisibleWarning(warning) || target.includes(warning)) {
      continue;
    }

    target.push(warning);
  }
}

function analysePage(artifact: Awaited<ReturnType<typeof fetchPage>>): PageAnalysis {
  const metadata = extractMetadataSignals(artifact);
  const contact = extractContactSignals(artifact, metadata);
  const offerings = extractOfferingSignals(artifact, metadata);
  const brand = extractBrandSignals(artifact, metadata);

  return {
    artifact,
    metadata,
    contact,
    offerings,
    brand
  };
}

async function persistAnalysedPage(jobId: string, analysis: PageAnalysis) {
  const pageId = crypto.randomUUID();
  const rawHtmlPath = await saveRawArtifact(jobId, pageId, analysis.artifact.html);

  await saveCrawledPage({
    id: pageId,
    ingestion_job_id: jobId,
    url: analysis.artifact.url,
    final_url: analysis.artifact.finalUrl,
    status_code: analysis.artifact.statusCode,
    fetch_mode: analysis.artifact.fetchMode,
    was_rendered: analysis.artifact.wasRendered,
    title: analysis.metadata.title,
    meta_description: analysis.metadata.metaDescription,
    raw_html_path: rawHtmlPath,
    text_content: analysis.metadata.visibleText.slice(0, 20_000),
    extracted_json: {
      metadata: analysis.metadata,
      contact: analysis.contact,
      offerings: analysis.offerings,
      brand: analysis.brand
    }
  });
}

async function fetchAndAnalysePage(url: string, warnings: string[]) {
  let artifact = await fetchPage(url);
  let analysis = analysePage(artifact);

  appendWarnings(warnings, artifact.fetchWarnings);

  if (
    needsRender({
      html: artifact.html,
      visibleText: analysis.metadata.visibleText,
      statusCode: artifact.statusCode
    })
  ) {
    artifact = await renderPage(url);
    analysis = analysePage(artifact);
    appendWarnings(warnings, artifact.fetchWarnings);
  }

  return analysis;
}

export async function runIngestion(jobId: string) {
  const job = await getIngestionJob(jobId);
  if (!job) {
    return;
  }

  const warnings = [...job.warnings];

  try {
    await updateIngestionStatus(jobId, "validating_url", 5, "Validating URL and safety policy");
    const normalized = await ensureSafeTarget(job.submitted_url);

    await updateIngestionStatus(jobId, "fetching_homepage", 10, "Fetching homepage", {
      normalizedUrl: normalized.normalizedUrl,
      canonicalKey: normalized.canonicalKey
    });

    const homepageAnalysis = await fetchAndAnalysePage(normalized.normalizedUrl, warnings);
    await persistAnalysedPage(jobId, homepageAnalysis);

    await updateIngestionStatus(jobId, "discovering_pages", 20, "Discovering high-signal pages", {
      warnings
    });

    const candidates = await discoverPages(homepageAnalysis);
    const analysedPages: PageAnalysis[] = [homepageAnalysis];

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      const progress = Math.min(30 + Math.round(((index + 1) / Math.max(candidates.length, 1)) * 30), 60);

      await updateIngestionStatus(jobId, "fetching_pages", progress, `Fetching prioritized page ${index + 1} of ${candidates.length}`, {
        warnings
      });

      try {
        const analysis = await fetchAndAnalysePage(candidate.url, warnings);
        analysedPages.push(analysis);
        await persistAnalysedPage(jobId, analysis);
      } catch (error) {
        appendWarnings(warnings, [
          `Failed to analyze ${candidate.url}: ${error instanceof Error ? error.message : "Unknown error"}`
        ]);
      }
    }

    if (!analysedPages.length) {
      throw new Error("No usable pages were analyzed");
    }

    await updateIngestionStatus(jobId, "extracting_business_data", 65, "Extracting structured business signals", {
      warnings
    });

    const businessContext = buildBusinessContext({
      submittedUrl: job.submitted_url,
      normalizedUrl: normalized.normalizedUrl,
      canonicalKey: normalized.canonicalKey,
      homepage: homepageAnalysis,
      pages: analysedPages,
      warnings
    });

    await updateIngestionStatus(jobId, "building_profile", 78, "Building business profile", {
      warnings
    });

    const agentRecommendation = recommendAgentType(businessContext);

    await updateIngestionStatus(jobId, "generating_agent", 88, "Generating starter deployment package", {
      warnings
    });

    const deploymentPackage = generateDeploymentPackage(businessContext, agentRecommendation);

    await saveBusinessProfile({
      userId: job.user_id,
      ingestionJobId: job.id,
      canonicalKey: normalized.canonicalKey,
      businessContext,
      agentRecommendation,
      deploymentPackage
    });

    await updateIngestionStatus(
      jobId,
      warnings.length ? "partial_success" : "completed",
      100,
      warnings.length ? "Completed with recoverable warnings" : "Completed",
      {
        warnings,
        normalizedUrl: normalized.normalizedUrl,
        canonicalKey: normalized.canonicalKey,
        completed: true
      }
    );
  } catch (error) {
    await updateIngestionStatus(jobId, "failed", job.progress_percent || 0, "Ingestion failed", {
      warnings,
      errorMessage: error instanceof Error ? error.message : "Unknown ingestion error",
      completed: true
    });
  }
}
