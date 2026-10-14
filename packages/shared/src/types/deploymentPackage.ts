export type DeploymentPackage = {
  agent_name: string;
  welcome_message: string;
  system_prompt: string;
  faq_seed: Array<{
    question: string;
    answer: string;
  }>;
  lead_form_schema: {
    fields: Array<{
      name: string;
      type: "text" | "email" | "tel" | "textarea" | "select";
      required: boolean;
      options?: string[];
    }>;
  };
  handoff_rules: string[];
  tool_config: {
    enabled_tools: string[];
  };
  branding: {
    logo_url: string;
    primary_color: string;
    secondary_color: string;
    font_family: string;
  };
};
