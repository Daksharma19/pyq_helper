const styles = {
  ok: "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300",
  error: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export function Notice({
  kind = "ok",
  children,
}: {
  kind?: keyof typeof styles;
  children: React.ReactNode;
}) {
  return (
    <p
      role={kind === "ok" ? "status" : "alert"}
      className={`rounded-md p-3 text-sm ${styles[kind]}`}
    >
      {children}
    </p>
  );
}
