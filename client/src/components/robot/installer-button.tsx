import { FC, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Check, X, AlertTriangle } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface InstallerButtonProps {
  serialNumber: string;
  installerPath?: string;
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

/**
 * Button to remotely execute the Robot AI installer on a robot
 */
const InstallerButton: FC<InstallerButtonProps> = ({
  serialNumber,
  installerPath = "/tmp/robot-ai-minimal-installer.py",
  size = "default",
  className = "",
}) => {
  const { toast } = useToast();
  const [showStatus, setShowStatus] = useState(false);

  // Check if Robot AI is installed
  const {
    data: aiStatus,
    isLoading: statusLoading,
    error: statusError,
    refetch: refetchStatus,
  } = useQuery<{
    installed: boolean;
    running: boolean;
    message: string;
  }>({
    queryKey: [`/api/robots/${serialNumber}/robot-ai-status`],
    enabled: !!serialNumber && showStatus,
    refetchInterval: showStatus ? 5000 : false, // Poll every 5 seconds when showing status
  });

  // Execute installer mutation
  const {
    mutate: executeInstaller,
    isPending,
    error,
  } = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        "POST",
        `/api/robots/${serialNumber}/execute-installer`,
        { installerPath }
      );
      if (!response.ok) {
        throw new Error(`Failed to execute installer: ${response.statusText}`);
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Installation Started",
        description: "Robot AI installation has been started successfully",
        variant: "default",
      });
      setShowStatus(true);
      refetchStatus();
    },
    onError: (error: Error) => {
      toast({
        title: "Installation Failed",
        description: `Failed to start installation: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Handle button click
  const handleClick = () => {
    if (isPending) return;

    // If we're showing status, toggle it off
    if (showStatus) {
      setShowStatus(false);
      return;
    }

    // Check if already installed
    if (aiStatus?.installed && aiStatus?.running) {
      toast({
        title: "Already Installed",
        description: "Robot AI is already installed and running",
        variant: "default",
      });
      return;
    }

    // Execute installer
    executeInstaller();
  };

  // Determine button state and content
  let buttonText = "Install Robot AI";
  let buttonIcon = <Upload className="h-4 w-4 mr-2" />;
  let buttonVariant: "default" | "outline" | "destructive" | "secondary" | "ghost" | "link" = "default";
  
  if (isPending) {
    buttonText = "Installing...";
    buttonIcon = <Loader2 className="h-4 w-4 mr-2 animate-spin" />;
    buttonVariant = "outline";
  } else if (showStatus) {
    if (statusLoading) {
      buttonText = "Checking...";
      buttonIcon = <Loader2 className="h-4 w-4 mr-2 animate-spin" />;
      buttonVariant = "outline";
    } else if (statusError) {
      buttonText = "Check Failed";
      buttonIcon = <AlertTriangle className="h-4 w-4 mr-2" />;
      buttonVariant = "destructive";
    } else if (aiStatus?.installed) {
      if (aiStatus.running) {
        buttonText = "AI Running";
        buttonIcon = <Check className="h-4 w-4 mr-2" />;
        buttonVariant = "secondary";
      } else {
        buttonText = "AI Installed";
        buttonIcon = <Check className="h-4 w-4 mr-2" />;
        buttonVariant = "outline";
      }
    } else {
      buttonText = "Not Installed";
      buttonIcon = <X className="h-4 w-4 mr-2" />;
      buttonVariant = "outline";
    }
  }

  return (
    <Button
      variant={buttonVariant}
      size={size}
      onClick={handleClick}
      disabled={isPending}
      className={className}
    >
      {buttonIcon}
      {buttonText}
    </Button>
  );
};

export default InstallerButton;