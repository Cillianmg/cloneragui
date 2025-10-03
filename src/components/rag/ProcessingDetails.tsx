import { CheckCircle, Clock, Loader2, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";

interface ProcessingStep {
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

interface ProcessingDetailsProps {
  progress: number;
  currentStep: string;
  eta: number | null;
  steps: ProcessingStep[];
  processingTime?: number;
}

export const ProcessingDetails = ({ 
  progress, 
  currentStep, 
  eta, 
  steps,
  processingTime 
}: ProcessingDetailsProps) => {
  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const formatEta = (seconds: number | null) => {
    if (!seconds) return 'Calculating...';
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  return (
    <Card className="p-4 space-y-4 animate-fade-in">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{currentStep}</span>
          <span className="text-muted-foreground">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {processingTime 
              ? `Completed in ${processingTime}s` 
              : eta !== null 
                ? `ETA: ${formatEta(eta)}` 
                : ''}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Processing Steps</h4>
        {steps.map((step, index) => (
          <div 
            key={index}
            className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 transition-all"
          >
            {getStepIcon(step.status)}
            <span className={`text-sm flex-1 ${
              step.status === 'completed' 
                ? 'text-muted-foreground line-through' 
                : step.status === 'processing'
                  ? 'font-medium'
                  : ''
            }`}>
              {step.name}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
};
