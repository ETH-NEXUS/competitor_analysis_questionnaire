export const useAPI = (request: string, options: object) => {
  const config = useRuntimeConfig();

  return useFetch(`/api/v1/${request}`, { baseURL: config.public.baseURL, server: false, ...options });
};
