# Hardware Acceleration Configuration

This reference details the configurations for hardware-accelerated video decoding in `mpv` via the `--hwdec` option.

## Hardware Decoding Methods (`--hwdec`)

Hardware decoding reduces CPU usage and power consumption, which is especially important for high-resolution streams (e.g., 4K).

### 1. Decoding Modes: Native vs Copy
`mpv` supports two modes of hardware decoding:

*   **Native (`auto`, `yes`, or API names like `vaapi`, `nvdec`)**:
    *   Decoded video frames remain in GPU memory and are rendered directly.
    *   **Pros**: Lowest CPU and memory bandwidth overhead; most efficient.
    *   **Cons**: Breaks internal video filters, subtitle rendering on the video frame, and high-quality screenshotting, as the player cannot access the raw decoded frames on the CPU.
*   **Copy-back (`auto-copy`, or API names with `-copy` suffix like `vaapi-copy`, `nvdec-copy`)**:
    *   Decoded frames are copied back from GPU memory into system RAM.
    *   **Pros**: Fully compatible with all video filters, custom shaders, and standard screenshotting.
    *   **Cons**: Slightly higher CPU and memory bandwidth overhead than native mode.

---

## Platform-Specific Configurations

Use the following API settings based on the target operating system:

### Linux
*   **Intel / AMD GPUs**: Use `vaapi` or `vaapi-copy`.
*   **NVIDIA GPUs**: Use `nvdec` or `nvdec-copy` (requires CUDA).
*   **Generic Vulkan**: Use `vulkan` or `vulkan-copy`.
*   **Recommended Safe Default**: `--hwdec=auto-safe` or `--hwdec=auto-copy`

### macOS
*   **All Apple Silicon and Intel Macs**: Use `videotoolbox` or `videotoolbox-copy`.
*   **Recommended Safe Default**: `--hwdec=auto`

### Windows
*   **Modern Windows (8+)**: Use `d3d11va` or `d3d11va-copy`.
*   **Older Windows**: Use `dxva2` or `dxva2-copy`.
*   **Recommended Safe Default**: `--hwdec=auto`

---

## Best Practices for Option Pages
When exposing hardware acceleration settings in a UI:
1.  Provide a dropdown containing:
    *   `Disabled` (maps to `--hwdec=no`)
    *   `Auto (Recommended)` (maps to `--hwdec=auto`)
    *   `Auto Copy-Back (Best Compatibility)` (maps to `--hwdec=auto-copy`)
2.  Optionally allow users to select platform-specific APIs directly (e.g. `vaapi`, `nvdec`, `videotoolbox`, `d3d11va`).
