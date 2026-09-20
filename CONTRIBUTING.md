# Contributing to VoidLAB

Thank you for reviewing the VoidLAB source code.

This document serves to explicitly outline the technical boundaries and licensing restrictions of this project.

## Technical Architecture Boundaries

If you are reviewing this architecture for authorized development or reference, note the following constraints:

1. **Client-Side Execution (WASM):** VoidLAB operates entirely without a traditional backend server. All real-time code execution is managed via WebAssembly (WASM) directly within the browser environment.
2. **Containerization (Docker):** For environments requiring external compilation, Docker is strictly utilized to provide isolated, containerized execution contexts.
3. **No Database:** There is no PostgreSQL, MongoDB, or any persistent database backend. State and configuration management are handled strictly on the client side.

Any technical inquiry or approved modifications must respect this strictly client-side, serverless, and database-free architecture.

## Strict Licensing and Usage Restrictions

VoidLAB is a proprietary project. It is **not** open-source.

In accordance with the `LICENSE`:
- **No Modifications:** You are strictly prohibited from modifying, adapting, or creating derivative works based on this code.
- **No Distribution:** You may not copy, reproduce, publish, host, or distribute this project in any form.
- **No Commercial or Non-Commercial Use:** The software cannot be utilized for any purpose without explicit written consent.
- **Pull Requests:** Do not submit pull requests, issues, or fork this repository with the intent of modification or distribution. They will be rejected.

If you have secured prior written permission from the author for a specific use case or collaboration, you must adhere strictly to the terms provided in your agreement.

Copyright (c) 2026 Rudranarayan Jena. All rights reserved.
