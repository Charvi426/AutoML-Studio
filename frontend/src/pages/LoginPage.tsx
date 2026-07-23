import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Title,
  Text,
  Stack,
  Alert,
  Center,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useAuth } from "../context/AuthContext";
import { extractErrorMessage } from "../api/client";

interface FormValues {
  email: string;
  password: string;
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    initialValues: { email: "", password: "" },
    validate: {
      email: (v) => (v.length > 0 ? null : "Email is required"),
      password: (v) => (v.length > 0 ? null : "Password is required"),
    },
  });

  async function handleSubmit(values: FormValues) {
    setError(null);
    setSubmitting(true);
    try {
      await login(values.email, values.password);
      navigate("/projects");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Center style={{ minHeight: "100vh" }} bg="gray.0">
      <Paper withBorder shadow="sm" p="xl" radius="md" w={380}>
        <Stack gap="md">
          <div>
            <Title order={2}>AutoML Studio</Title>
            <Text c="dimmed" size="sm">
              Sign in to your account
            </Text>
          </div>
          {error && (
            <Alert color="red" title="Login failed">
              {error}
            </Alert>
          )}
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="sm">
              <TextInput
                label="Email"
                placeholder="you@example.com"
                {...form.getInputProps("email")}
              />
              <PasswordInput
                label="Password"
                placeholder="Your password"
                {...form.getInputProps("password")}
              />
              <Button type="submit" fullWidth loading={submitting} mt="sm">
                Sign in
              </Button>
            </Stack>
          </form>
          <Text size="sm" ta="center">
            Don't have an account? <Link to="/register">Register</Link>
          </Text>
        </Stack>
      </Paper>
    </Center>
  );
}
