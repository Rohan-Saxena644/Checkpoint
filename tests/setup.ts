import { createCheckpointServer } from "../apps/showcase/server/index.js";
export default async function setup() {
  const instance = await createCheckpointServer({
    production: true,
    origin: "http://localhost:4173",
  });
  await new Promise<void>((resolve) =>
    instance.server.listen(4173, "127.0.0.1", resolve),
  );
  process.env.CHECKPOINT_TEST_CODE = instance.controlCode;
  return () => instance.close();
}
