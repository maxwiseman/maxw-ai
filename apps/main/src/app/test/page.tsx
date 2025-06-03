import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@acme/ui/reasoning";

export default function TestPage() {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-4">
      <Reasoning className="text-muted-foreground">
        <ReasoningTrigger>Thinking...</ReasoningTrigger>
        <ReasoningContent>Text</ReasoningContent>
      </Reasoning>
    </div>
  );
}
