"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import api from "@/lib/api";

const apiSchema = z.object({
  name: z.string().min(2, "Name required"),
  path: z.string().min(1, "Path required"),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  description: z.string().optional(),
});

type ApiForm = z.infer<typeof apiSchema>;

export default function NewApiPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ApiForm>({
    resolver: zodResolver(apiSchema),
    defaultValues: { method: "GET" },
  });

  const onSubmit = async (data: ApiForm) => {
    setIsLoading(true);
    setError(null);
    try {
      await api.post("/custom-apis", data);
      router.push("/apis");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Error creating API");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">New API Personalizada</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register("name")} />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="path">Path</Label>
              <Input id="path" placeholder="/meu-endpoint" {...register("path")} />
              {errors.path && <p className="text-red-500 text-xs mt-1">{errors.path.message}</p>}
            </div>
            <div>
              <Label htmlFor="method">Method</Label>
              <select id="method" {...register("method")} className="w-full border rounded px-2 py-1">
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
              {errors.method && <p className="text-red-500 text-xs mt-1">{errors.method.message}</p>}
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input id="description" {...register("description")} />
            </div>
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create API"}
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={() => router.push("/apis")}>Cancel</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
