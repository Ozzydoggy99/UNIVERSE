import React from 'react';
import { renderToString } from 'react-dom/server';
import { Request, Response } from 'express';
import { storage } from './mem-storage';
import { User } from '../shared/schema';
import { Session } from 'express-session';

// Add session property to Request
declare module 'express-session' {
  interface Session {
    user?: { id: number; username: string; role: string };
  }
}

// Admin authentication middleware
export async function adminRequired(req: Request, res: Response, next: Function) {
  if (!req.session.user) {
    return res.redirect('/auth');
  }
  
  const user = await storage.getUser(req.session.user.id);
  if (!user || user.role !== 'admin') {
    return res.redirect('/auth');
  }
  
  next();
}

// Server-side render admin pages
export async function renderAdminPage(req: Request, res: Response, componentFn: (props: any) => React.ReactElement) {
  try {
    // Ensure the user is authenticated and an admin
    if (!req.session.user) {
      return res.redirect('/auth');
    }
    
    const user = await storage.getUser(req.session.user.id);
    if (!user || user.role !== 'admin') {
      return res.redirect('/auth');
    }
    
    const props = {
      user,
      path: req.path,
      query: req.query,
      params: req.params,
    };
    
    // Render the React component to HTML
    const component = componentFn(props);
    const html = renderToString(component);
    
    // Render a full HTML page
    const fullHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Dashboard</title>
        <link rel="stylesheet" href="/assets/admin.css">
      </head>
      <body>
        <div id="root">${html}</div>
        <script>
          window.__INITIAL_STATE__ = ${JSON.stringify({ user })};
        </script>
        <script src="/assets/admin-bundle.js"></script>
      </body>
      </html>
    `;
    
    res.send(fullHtml);
  } catch (error) {
    console.error('Error rendering admin page:', error);
    res.status(500).send('Server error rendering admin page');
  }
}

// Function to create pre-rendered HTML for admin templates
export async function getAdminTemplatesList() {
  try {
    const templates = await storage.getAllTemplates();
    return templates.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      createdAt: template.createdAt,
      layout: JSON.parse(template.layout || '{}'),
    }));
  } catch (error) {
    console.error('Error getting admin templates:', error);
    throw new Error('Failed to retrieve admin templates');
  }
}

// Function to get template assignments for admin
export async function getTemplateAssignments() {
  try {
    const assignments = await storage.getAllRobotTemplateAssignments();
    return assignments;
  } catch (error) {
    console.error('Error getting template assignments:', error);
    throw new Error('Failed to retrieve template assignments');
  }
}