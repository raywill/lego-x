export function captureProjectThumbnail(): string {
  const canvas = document.querySelector<HTMLCanvasElement>('.scene-panel canvas');
  if (canvas) {
    try {
      const output = document.createElement('canvas');
      output.width = 640;
      output.height = 480;
      const context = output.getContext('2d');
      if (context) {
        context.fillStyle = '#f4f7fd';
        context.fillRect(0, 0, output.width, output.height);
        const scale = Math.min(output.width / canvas.width, output.height / canvas.height);
        const width = canvas.width * scale;
        const height = canvas.height * scale;
        context.drawImage(canvas, (output.width - width) / 2, (output.height - height) / 2, width, height);
        return output.toDataURL('image/webp', 0.78);
      }
    } catch {
      // WebGL readback can be unavailable on some browsers; use the fallback below.
    }
  }
  const output = document.createElement('canvas');
  output.width = 640;
  output.height = 480;
  const context = output.getContext('2d');
  if (context) {
    context.fillStyle = '#f4f7fd';
    context.fillRect(0, 0, 640, 480);
    context.fillStyle = '#6c5ce7';
    context.fillRect(220, 185, 200, 120);
    context.fillStyle = '#4c42b7';
    context.fillRect(250, 155, 45, 28);
    context.fillRect(305, 155, 45, 28);
    context.fillRect(360, 155, 45, 28);
  }
  return output.toDataURL('image/webp', 0.78);
}
