# AE Bridge: Agent Execution Rules & Guardrails

When automating Adobe After Effects or Blender via AE Bridge, agents MUST strictly follow these rules:

1. **Pre-Flight Health Verification:**
   - ALWAYS call `ae_bridge_status` before attempting any project, comp, or layer mutation.
   - If `connected` is false, halt mutating calls and advise the user to open After Effects and launch the AE Bridge CEP panel (`Window > Extensions > AE Bridge`).

2. **Atomic Batching & Undo Safety:**
   - Group multi-step layer creation or modification sequences inside `ae_batch`. This minimizes network round-trips and guarantees that all operations execute within a single ExtendScript undo group.
   - If an unexpected error occurs during multi-step setup, invoke `ae_undo` to cleanly restore the user's project state.

3. **Property Hierarchy Introspection:**
   - NEVER guess or hallucinate property names or effect parameter paths.
   - When configuring custom effects, masks, or animators, call `ae_describe_property_tree` to discover the exact internal property names and data types.

4. **Non-Blocking Renders for Long Compositions:**
   - For compositions longer than 5 seconds or with multi-pass 3D renders, PREFER non-blocking background rendering with `ae_render_job_start` over synchronous `ae_render`.
   - Monitor job progress asynchronously with `ae_render_job_status`.

5. **Blender Scene Spec Pre-Flight Validation:**
   - ALWAYS validate complex 3D scene specifications with `blender_validate_spec` before calling `blender_render_job_start`.
   - Ensure render resolution, frame rates, and camera targets match the target After Effects comp before starting long render jobs.
