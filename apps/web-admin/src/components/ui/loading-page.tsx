export function LoadingPage() {
  return (
    <div className="flex items-center justify-center h-64">
      <span className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mr-2" />
      <span>Loading...</span>
    </div>
  );
}
