interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export default {
  fetch(request: Request, env: { ASSETS: AssetsBinding }): Promise<Response> {
    return env.ASSETS.fetch(request);
  },
};
