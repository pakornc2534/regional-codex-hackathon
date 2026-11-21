import fs from "node:fs";
import path from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Store } from "./persistence";
import { api } from "./api";
if (fs.existsSync(".env")) process.loadEnvFile(".env");
const prod =
  process.argv.includes("--production") ||
  process.env.NODE_ENV === "production";
const store = await Store.open(path.resolve(process.env.DATA_DIR ?? ".data"));
const app = api(store);
if (prod) {
  app.use("/assets/*", serveStatic({ root: "./dist" }));
  app.get("*", (c) => c.html(fs.readFileSync("dist/index.html", "utf8")));
}
serve(
  {
    fetch: app.fetch,
    port: Number(process.env.PORT ?? (prod ? 4310 : 4311)),
    hostname: process.env.HOST ?? "127.0.0.1",
  },
  (info) => console.log("Ran Rao ready on port", info.port),
);
