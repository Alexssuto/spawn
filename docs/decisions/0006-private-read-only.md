# 0006: Private repository, no public deployment, read-only API

**Status:** Proposed

## Context

Spawn is a portfolio project. The owner wants it private for now, without public hosting and without exposed credentials.

## Decision

- The GitHub repository stays **private**; visibility changes only with the owner's explicit approval.
- Nothing is deployed publicly. CI builds and tests, including the Docker image, but never pushes or deploys.
- The Phase 2a API is **read-only**. Ingestion runs from the command line, not through an HTTP endpoint, so no write endpoint needs authentication yet.
- Configuration comes from environment variables (pydantic-settings). `.env` files are gitignored; a committed `.env.example` lists the variable names with safe local values only.
- CI uses a throwaway database with dummy credentials defined in the workflow, which are not secrets.

## Consequences

- No account system or authentication is needed until server-side catches arrive (with photo verification).
- Demonstrating the app means running it locally or recording a video, not sharing a link.
- When public deployment is wanted, it needs a new ADR covering hosting, secrets management and authentication.
