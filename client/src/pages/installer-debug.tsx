import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle2, XCircle, Info, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const InstallerDebugPage = () => {
  const { toast } = useToast();
  const [serialNumber, setSerialNumber] = useState('L382502104987ir');
  const [installerPath, setInstallerPath] = useState('/home/robot/robot-ai-minimal-installer.py');
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [fileCheckResult, setFileCheckResult] = useState<any>(null);
  const [executeResult, setExecuteResult] = useState<any>(null);
  const [statusResult, setStatusResult] = useState<any>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);

  const handleTestConnection = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/robots/${serialNumber}/test-connection`);
      const result = await response.json();
      setTestResult(result);
      
      toast({
        title: result.success ? 'Connection successful' : 'Connection failed',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Error testing connection:', error);
      setTestResult({ 
        success: false, 
        message: `Error: ${error.message}` 
      });
      
      toast({
        title: 'Connection failed',
        description: `Error: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckInstaller = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/robots/${serialNumber}/check-installer?path=${encodeURIComponent(installerPath)}`);
      const result = await response.json();
      setFileCheckResult(result);
      
      toast({
        title: result.success ? 'File check completed' : 'File check failed',
        description: result.exists 
          ? `Installer found at ${result.path}` 
          : result.alternativeExists 
            ? `Installer found at alternate path: ${result.alternativePath}` 
            : 'Installer not found',
        variant: (result.success && (result.exists || result.alternativeExists)) ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Error checking installer:', error);
      setFileCheckResult({ 
        success: false, 
        message: `Error: ${error.message}` 
      });
      
      toast({
        title: 'File check failed',
        description: `Error: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteInstaller = async () => {
    setLoading(true);
    try {
      // Determine which installer path to use
      const effectiveInstallerPath = fileCheckResult?.exists 
        ? fileCheckResult.path 
        : fileCheckResult?.alternativeExists 
          ? fileCheckResult.alternativePath 
          : installerPath;
      
      console.log(`Executing installer at path: ${effectiveInstallerPath}`);
      
      const response = await fetch(`/api/robots/${serialNumber}/execute-installer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          installerPath: effectiveInstallerPath
        }),
      });
      
      const result = await response.json();
      setExecuteResult(result);
      
      toast({
        title: result.success ? 'Execution started' : 'Execution failed',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Error executing installer:', error);
      setExecuteResult({ 
        success: false, 
        message: `Error: ${error.message}` 
      });
      
      toast({
        title: 'Execution failed',
        description: `Error: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/robots/${serialNumber}/robot-ai-status`);
      const result = await response.json();
      setStatusResult(result);
      
      toast({
        title: 'Status check completed',
        description: result.message || (result.installed ? 
          (result.running ? 'Robot AI is running' : 'Robot AI is installed but not running') 
          : 'Robot AI is not installed'),
        variant: 'default',
      });
    } catch (error) {
      console.error('Error checking status:', error);
      setStatusResult({ 
        success: false, 
        message: `Error: ${error.message}` 
      });
      
      toast({
        title: 'Status check failed',
        description: `Error: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleUploadInstaller = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/robots/${serialNumber}/upload-installer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          destinationPath: installerPath 
        }),
      });
      
      const result = await response.json();
      setUploadResult(result);
      
      toast({
        title: result.success ? 'Upload successful' : 'Upload failed',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Error uploading installer:', error);
      setUploadResult({ 
        success: false, 
        message: `Error: ${error.message}` 
      });
      
      toast({
        title: 'Upload failed',
        description: `Error: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const renderResultCard = (title: string, result: any, onAction: () => void, actionText: string) => {
    if (!result) return null;
    
    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center">
            {result.success 
              ? <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" /> 
              : <XCircle className="h-5 w-5 mr-2 text-red-500" />}
            {title}
          </CardTitle>
          <CardDescription>{result.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-md overflow-auto max-h-64 text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        </CardContent>
        <CardFooter>
          <Button onClick={onAction} variant="outline">
            {actionText}
          </Button>
        </CardFooter>
      </Card>
    );
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Robot AI Installer Debug</h1>
        <Button onClick={handleTestConnection} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Info className="h-4 w-4 mr-2" />}
          Test Connection
        </Button>
      </div>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>Set the robot serial number and installer path</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="serialNumber">Robot Serial Number</Label>
              <Input
                id="serialNumber"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="Enter robot serial number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="installerPath">Installer Path</Label>
              <Input
                id="installerPath"
                value={installerPath}
                onChange={(e) => setInstallerPath(e.target.value)}
                placeholder="Enter installer path"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2 justify-between">
          <Button onClick={handleUploadInstaller} disabled={loading} variant="secondary">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Upload Installer
          </Button>
          <Button onClick={handleCheckInstaller} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Check Installer
          </Button>
          <Button onClick={handleExecuteInstaller} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Execute Installer
          </Button>
          <Button onClick={handleCheckStatus} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Check Status
          </Button>
        </CardFooter>
      </Card>
      
      <div className="space-y-6">
        {testResult && renderResultCard('Connection Test Result', testResult, handleTestConnection, 'Test Again')}
        {uploadResult && renderResultCard('Upload Result', uploadResult, handleUploadInstaller, 'Upload Again')}
        {fileCheckResult && renderResultCard('File Check Result', fileCheckResult, handleCheckInstaller, 'Check Again')}
        {executeResult && renderResultCard('Execution Result', executeResult, handleExecuteInstaller, 'Execute Again')}
        {statusResult && renderResultCard('Status Result', statusResult, handleCheckStatus, 'Check Again')}
      </div>
      
      <Separator className="my-8" />
      
      <div className="text-sm text-muted-foreground">
        <p>Debugging tools for Robot AI installer.</p>
        <p>This page helps diagnose installation issues by testing each step separately.</p>
      </div>
    </div>
  );
};

export default InstallerDebugPage;