export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
      <span className="text-lg">{message}</span>
    </div>
  );
}
