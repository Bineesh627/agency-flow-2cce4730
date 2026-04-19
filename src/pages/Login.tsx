import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Briefcase, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FormValues {
  email: string;
  password: string;
}

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>();

  if (!isLoading && user) {
    const from = (location.state as any)?.from?.pathname ?? "/dashboard";
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email.trim(),
      password: values.password,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back");
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <Briefcase className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold">Agency PM</h1>
        </div>
        <div className="card-elevated p-8">
          <h2 className="text-xl font-semibold mb-1">Sign in</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Enter your credentials to access the workspace
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@agency.com"
                autoComplete="email"
                {...register("email", { required: "Email is required" })}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password", { required: "Password is required" })}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sign in
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-6 text-center">
            Don't have an account? Contact your administrator.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
