import { z } from "zod";
import type { HealthResponse } from "./types";

const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "unavailable"]),
  service: z.string(),
  version: z.string()
});

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

async function request<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return schema.parse(await response.json());
}

export const apiClient = {
  health: (): Promise<HealthResponse> => request("/health", healthResponseSchema)
};

