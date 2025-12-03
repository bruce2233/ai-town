# CI/CD Pipeline

This project uses **GitHub Actions** for Continuous Integration.

## Workflow: `ci.yml`

The pipeline is triggered on:
- Pushes to `main`
- Pull Requests targeting `main`

### Jobs

1.  **Lint**:
    - Runs `eslint` on Broker, Agents, and Frontend.
    - Ensures code quality and consistency.

2.  **Test**:
    - Runs `jest` unit tests for Broker and Agents.
    - Ensures no regressions in core logic.

3.  **Build**:
    - Builds the Frontend using `vite build`.
    - Verifies that the frontend compiles without errors.

## Git Workflow

We follow a **Feature Branch Workflow**:
1.  Create a new branch for your feature: `git checkout -b feature/my-feature`
2.  Commit your changes.
3.  Push to GitHub: `git push origin feature/my-feature`
4.  Open a Pull Request.
5.  **CI Checks** will run automatically.
6.  Once checks pass and code is reviewed, merge into `main`.
