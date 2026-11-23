# Contributing to AE Bridge

Thank you for your interest in improving AE Bridge!

---

## Code of Conduct

We are committed to providing a friendly, safe, and welcoming environment for everyone. Please treat contributors and users with respect, kindness, and constructive feedback.

---

## How to Contribute

1. **Report Bugs:** Open an issue using our [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md) with steps to reproduce, your OS, After Effects version, and `ae-bridge doctor` output.
2. **Suggest Enhancements:** Propose new motion graphic presets, effects, or workflow recipes using our [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md).
3. **Submit Pull Requests:**
   - Fork the repository and create a descriptive feature branch.
   - Follow the [Contributing Tools Guide](docs/contributing-tools.md).
   - Ensure all tests pass: `npm --prefix server test`.
   - Ensure TypeScript builds cleanly: `npm --prefix server run build`.
   - Update documentation: `npm --prefix server run docs`.

---

## Coding Standards

- **TypeScript:** Strict type checking (`noImplicitAny: true`).
- **Zod Schemas:** Always use `z.array()` rather than `z.tuple()` for array parameters.
- **ExtendScript:** Wrap mutations in `withUndo("Action Name", function() { ... })` and use defensive `try/catch/finally` blocks around temporary composition resources.
- **Privacy:** Never commit machine-specific absolute user paths.
