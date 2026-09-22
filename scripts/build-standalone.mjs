import { build } from "esbuild";
import fs from "node:fs/promises";
const result = await build({
  entryPoints: ["src/main.js"],
  bundle: true,
  format: "iife",
  minify: true,
  write: false,
  loader: { ".css": "empty" },
  target: "es2022",
});
let css = await fs.readFile("src/style.css", "utf8");
for (const font of ["lilita-one.ttf", "dm-sans-600.ttf"]) {
  const bytes = await fs.readFile("public/fonts/" + font);
  css = css.replaceAll(
    `/fonts/${font}`,
    `data:font/ttf;base64,${bytes.toString("base64")}`,
  );
}
let html = await fs.readFile("index.html", "utf8");
const licenses = {};
for (const name of ["lilita-OFL.txt", "dmsans-OFL.txt"])
  licenses[name] = await fs.readFile("public/fonts/" + name, "utf8");
html = html.replace(
  "</body>",
  `<script type="application/json" id="font-licenses">${JSON.stringify(licenses)}</script></body>`,
);
const icon = await fs.readFile("public/icon.svg", "utf8");
html = html.replace(
  "./icon.svg",
  "data:image/svg+xml," + encodeURIComponent(icon),
);
html = html.replace(
  '<script type="module" src="/src/main.js"></script>',
  `<style>${css}</style><script>${result.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script>`,
);
await fs.mkdir("dist", { recursive: true });
await fs.writeFile("dist/Deadwood.html", html);
console.log(
  `Standalone HTML: ${(Buffer.byteLength(html) / 1024).toFixed(0)} KiB`,
);
