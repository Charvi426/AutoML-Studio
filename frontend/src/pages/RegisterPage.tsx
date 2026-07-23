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
  name: string;
  email: string;
  password: string;
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    initialValues: { name: "", email: "", password: "" },
    validate: {
      name: (v) => (v.length > 0 ? null : "Name is required"),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Enter a valid email"),
      password: (v) => (v.length >= 8 ? null : "Password must be at least 8 characters"),
    },
  });

  async function handleSubmit(values: FormValues) {
    setError(null);
    setSubmitting(true);
    try {
      await register(values.name, values.email, values.password);
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
            <Title order={2}>Create your account</Title>
            <Text c="dimmed" size="sm">
              Start building with AutoML Studio
            </Text>
          </div>
          {error && (
            <Alert color="red" title="Registration failed">
              {error}
            </Alert>
          )}
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="sm">
              <TextInput label="Name" placeholder="Charvi" {...form.getInputProps("name")} />
              <TextInput
                label="Email"
                placeholder="you@example.com"
                {...form.getInputProps("email")}
              />
              <PasswordInput
                label="Password"
                placeholder="At least 8 characters"
                {...form.getInputProps("password")}
              />
              <Button type="submit" fullWidth loading={submitting} mt="sm">
                Create account
              </Button>
            </Stack>
          </form>
          <Text size="sm" ta="center">
            Already have an account? <Link to="/login">Sign in</Link>
          </Text>
        </Stack>
      </Paper>
    </Center>
  );
}
