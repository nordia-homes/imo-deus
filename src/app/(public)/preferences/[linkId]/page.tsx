'use client';
import { useState } from 'react';
import { Bot, Menu, MapPin, ChevronRight, Smile, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function PreferencesChatPage() {
  const [selectedBudget, setSelectedBudget] = useState('150.000€');
  const [selectedRooms, setSelectedRooms] = useState(2);

  const AiBubble = ({ children }: { children: React.ReactNode }) => (
    <div className="self-start max-w-[85%] bg-[#251A46] p-4 rounded-2xl rounded-bl-sm shadow-lg">
      <p>{children}</p>
    </div>
  );

  const OptionButton = ({
    children,
    onClick,
    isSelected,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    isSelected: boolean;
  }) => (
    <button
      onClick={onClick}
      className={cn(
        'px-5 py-3 rounded-xl text-sm font-medium transition-all backdrop-blur-sm',
        isSelected
          ? 'bg-gradient-to-r from-[#6382FF] to-[#9166FF] text-white shadow-[0_0_20px_rgba(122,102,255,0.5)]'
          : 'bg-[#251A46]/80 text-white/80 hover:bg-[#251A46]'
      )}
    >
      {isSelected ? `${children} ✓` : children}
    </button>
  );
  
  const SelectOptionButton = ({ children }: { children: React.ReactNode }) => (
     <button className="w-full flex items-center justify-between px-5 py-4 rounded-xl text-sm font-medium transition-all bg-[#251A46]/80 text-white/80 hover:bg-[#251A46]">
        <div className="flex items-center gap-3">
            {children}
        </div>
        <ChevronRight className="h-5 w-5" />
    </button>
  )

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between p-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12">
             <div className="absolute inset-0 bg-gradient-to-br from-[#6382FF] to-[#9166FF] rounded-full blur-sm"></div>
             <div className="relative flex items-center justify-center h-12 w-12 bg-slate-900 rounded-full border-2 border-[#372d64]">
                 <Bot className="h-7 w-7 text-blue-300" />
             </div>
          </div>
          <div>
            <h1 className="font-bold text-lg">Căutare Proprietăți</h1>
            <p className="text-sm text-white/70">Îți stau la dispoziție!</p>
          </div>
        </div>
        <button aria-label="Meniu">
          <Menu className="h-6 w-6 text-white/80" />
        </button>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-8">
        <div className="flex flex-col items-start space-y-4">
          <AiBubble>Te ajut să găsești proprietatea perfectă.</AiBubble>
          
          <AiBubble>Ce buget ai?</AiBubble>
          
          <div className="self-stretch flex flex-wrap gap-2">
            <OptionButton isSelected={selectedBudget === '80.000€'} onClick={() => setSelectedBudget('80.000€')}>80.000€</OptionButton>
            <OptionButton isSelected={selectedBudget === '100.000€'} onClick={() => setSelectedBudget('100.000€')}>100.000€</OptionButton>
            <OptionButton isSelected={selectedBudget === '150.000€'} onClick={() => setSelectedBudget('150.000€')}>150.000€</OptionButton>
             <OptionButton isSelected={selectedBudget === 'altul'} onClick={() => setSelectedBudget('altul')}>Alt buget...</OptionButton>
          </div>
        </div>

        <div className="flex flex-col items-start space-y-4">
          <AiBubble>Câte camere îți dorești?</AiBubble>
          <div className="self-stretch flex flex-wrap gap-2">
            <OptionButton isSelected={selectedRooms === 1} onClick={() => setSelectedRooms(1)}>1</OptionButton>
            <OptionButton isSelected={selectedRooms === 2} onClick={() => setSelectedRooms(2)}>2</OptionButton>
            <OptionButton isSelected={selectedRooms === 3} onClick={() => setSelectedRooms(3)}>3</OptionButton>
          </div>
        </div>
        
         <div className="flex flex-col items-start space-y-4">
          <AiBubble>În ce oraș cauți?</AiBubble>
          <div className="self-stretch">
             <SelectOptionButton>
                <MapPin className="h-5 w-5 text-blue-400" />
                <span>Selectează oraș</span>
            </SelectOptionButton>
          </div>
        </div>
      </main>

      {/* Input Footer */}
      <footer className="p-4 flex-shrink-0">
        <div className="relative flex items-center">
          <Input
            placeholder="Scrie mesajul tău..."
            className="w-full h-14 pl-12 pr-16 rounded-full bg-[#251A46]/80 border-none placeholder:text-white/50 text-white focus:ring-2 focus:ring-blue-500/50"
          />
          <Smile className="absolute left-4 h-6 w-6 text-white/50" />
           <Button size="icon" className="absolute right-2 h-11 w-11 rounded-full bg-gradient-to-br from-[#6382FF] to-[#9166FF] shadow-[0_0_15px_rgba(122,102,255,0.4)]">
             <Send className="h-5 w-5" />
           </Button>
        </div>
      </footer>
    </div>
  );
}
