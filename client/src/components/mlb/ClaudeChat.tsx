import { useState } from "react";
import { MessageSquare, Send, Loader2, Bot, User, X } from "lucide-react";
import { trpc } from "../../main";
import { cn } from "../../lib/utils";

export default function ClaudeChat() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const askMutation = trpc.claude.ask.useMutation({
    onSuccess: (data) => setMessages((prev) => [...prev, { role: "assistant", text: data.answer }]),
    onError: (err) => setMessages((prev) => [...prev, { role: "assistant", text: `Error: ${err.message}` }]),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || askMutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    askMutation.mutate({ question, context: "MLB predictions" });
    setQuestion("");
  }

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)} className={cn("fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-lg transition-all", isOpen ? "bg-red-500 hover:bg-red-400" : "bg-emerald-500 hover:bg-emerald-400")}>
        {isOpen ? <X className="w-6 h-6 text-white" /> : <Bot className="w-6 h-6 text-black" />}
      </button>
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] bg-[#111111] border border-[#1a1a1a] rounded-xl shadow-2xl flex flex-col max-h-[600px]">
          <div className="p-4 border-b border-[#1a1a1a] flex items-center gap-2">
            <Bot className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold text-white">MLB Edge Assistant</span>
            <span className="text-xs text-gray-500 ml-auto">Powered by Claude</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <Bot className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                <p className="text-sm">Ask me anything about today's predictions!</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && <Bot className="w-5 h-5 text-emerald-400 shrink-0 mt-1" />}
                <div className={cn("rounded-lg px-3 py-2 text-sm max-w-[80%]", msg.role === "user" ? "bg-emerald-500/10 text-white" : "bg-[#1a1a1a] text-gray-300")}>{msg.text}</div>
                {msg.role === "user" && <User className="w-5 h-5 text-gray-500 shrink-0 mt-1" />}
              </div>
            ))}
            {askMutation.isPending && (
              <div className="flex gap-2"><Bot className="w-5 h-5 text-emerald-400 shrink-0" /><div className="bg-[#1a1a1a] rounded-lg px-3 py-2"><Loader2 className="w-4 h-4 animate-spin text-emerald-400" /></div></div>
            )}
          </div>
          <form onSubmit={handleSubmit} className="p-4 border-t border-[#1a1a1a]">
            <div className="flex gap-2">
              <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about today's picks..." className="flex-1 bg-[#1a1a1a] border border-[#1a1a1a] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/30" />
              <button type="submit" disabled={askMutation.isPending || !question.trim()} className="bg-emerald-500 text-black p-2 rounded-lg hover:bg-emerald-400 disabled:opacity-50"><Send className="w-4 h-4" /></button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
