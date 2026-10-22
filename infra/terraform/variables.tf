variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "env" {
  description = "Deployment environment (prod | staging)"
  type        = string
  default     = "prod"
}

variable "vpc_id" {
  description = "VPC ID for all resources"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for RDS and ElastiCache"
  type        = list(string)
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_password" {
  description = "RDS master password — supply via TF_VAR_db_password env var, never hardcode"
  type        = string
  sensitive   = true
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t4g.micro"
}

variable "app_image" {
  description = "ECR image URI for the Next.js app (e.g. 123456789.dkr.ecr.us-east-1.amazonaws.com/lumigift:latest)"
  type        = string
}

variable "domain_name" {
  description = "Root domain name managed in Route 53 (e.g. lumigift.app)"
  type        = string
}

# ─── #104: Backup automation variables ───────────────────────────────────────

variable "ops_alert_email" {
  description = "Email address that receives backup failure SNS alerts"
  type        = string
  default     = "ops@lumigift.app"
}

# ─── #292: Terraform remote state + OIDC variables ───────────────────────────

variable "github_org" {
  description = "GitHub organisation or user that owns the repository (used to scope the OIDC trust policy)"
  type        = string
  default     = "joekeyz8"
}

variable "github_repo" {
  description = "GitHub repository name (used to scope the OIDC trust policy)"
  type        = string
  default     = "Lumigift-lumigift"
}

variable "tf_state_kms_key_id" {
  description = "Pre-created KMS key ID for Terraform state encryption. Must be bootstrapped before the first `terraform init`. Supply via TF_VAR_tf_state_kms_key_id env var."
  type        = string
  # No default — this must be set explicitly to prevent accidental unencrypted state.
}
