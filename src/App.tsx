import { useState, useEffect } from 'react';
import {
  Box,
  CssBaseline,
  ThemeProvider,
  createTheme,
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Breadcrumbs,
  Link,
  Container,
  Paper,
} from '@mui/material';
import { invoke } from '@tauri-apps/api/core';

// Helper function to get invoke with fallback
const getInvoke = () => {
  if (typeof invoke !== 'undefined') {
    return invoke;
  }
  // Fallback to global Tauri API
  return (window as any).__TAURI_INVOKE__ || (window as any).__TAURI__?.invoke;
};
import SubjectsManager from './components/SubjectsManager';
import AssessmentsManager from './components/AssessmentsManager';
import CategoriesManager from './components/CategoriesManager';
import ParagraphsManager from './components/ParagraphsManager';
import GlobalParagraphsManager from './components/GlobalParagraphsManager';
import { Subject, Assessment, Category, Paragraph } from './types';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const drawerWidth = 240;

function App() {
  const [currentView, setCurrentView] = useState('subjects');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{label: string, path: string}>>([
    { label: 'Subjects', path: 'subjects' }
  ]);

  // Initialize database
  useEffect(() => {
    initializeDatabase();
  }, []);

  const initializeDatabase = async () => {
    try {
      console.log('Initializing database...');
      
      // Get invoke function with fallback
      const invokeFn = getInvoke();
      console.log('Tauri API available:', typeof invokeFn);
      
      // Check if Tauri API is available
      if (typeof invokeFn === 'undefined') {
        console.warn('Tauri API is not available. Running in browser mode with mock data.');
        // Initialize with mock data for browser testing
        setSubjects([
          { id: 1, name: 'Sample Subject', created_at: new Date().toISOString() }
        ]);
        setCategories([
          { id: 1, name: 'General', created_at: new Date().toISOString() },
          { id: 2, name: 'Technical', created_at: new Date().toISOString() }
        ]);
        return;
      }
      
      await invokeFn('init_database');
      console.log('Database initialized successfully');
      await loadSubjects();
      await loadCategories();
    } catch (error) {
      console.error('Failed to initialize database:', error);
      alert('Failed to initialize database: ' + error);
    }
  };

  const loadSubjects = async () => {
    try {
      console.log('Loading subjects...');
      
      // Get invoke function with fallback
      const invokeFn = getInvoke();
      
      // Check if Tauri API is available
      if (typeof invokeFn === 'undefined') {
        console.warn('Tauri API not available, using mock data');
        return;
      }
      
      const data = await invokeFn('get_subjects');
      console.log('Subjects loaded:', data);
      setSubjects(data as Subject[]);
    } catch (error) {
      console.error('Failed to load subjects:', error);
      alert('Failed to load subjects: ' + error);
    }
  };

  const loadAssessments = async (subjectId: number) => {
    try {
      // Get invoke function with fallback
      const invokeFn = getInvoke();
      
      // Check if Tauri API is available
      if (typeof invokeFn === 'undefined') {
        console.warn('Tauri API not available, using mock data');
        return;
      }
      
      const data = await invokeFn('get_assessments', { subjectId });
      setAssessments(data as Assessment[]);
    } catch (error) {
      console.error('Failed to load assessments:', error);
    }
  };

  const loadCategories = async () => {
    try {
      // Get invoke function with fallback
      const invokeFn = getInvoke();
      
      // Check if Tauri API is available
      if (typeof invokeFn === 'undefined') {
        console.warn('Tauri API not available, using mock data');
        return;
      }
      
      const data = await invokeFn('get_categories');
      setCategories(data as Category[]);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadParagraphs = async (assessmentId: number) => {
    try {
      // Get invoke function with fallback
      const invokeFn = getInvoke();
      
      // Check if Tauri API is available
      if (typeof invokeFn === 'undefined') {
        console.warn('Tauri API not available, using mock data');
        return;
      }
      
      const data = await invokeFn('get_paragraphs', { assessmentId });
      setParagraphs(data as Paragraph[]);
    } catch (error) {
      console.error('Failed to load paragraphs:', error);
    }
  };

  const handleSubjectSelect = async (subject: Subject) => {
    setSelectedSubject(subject);
    setCurrentView('assessments');
    setBreadcrumbs([
      { label: 'Subjects', path: 'subjects' },
      { label: subject.name, path: 'assessments' }
    ]);
    await loadAssessments(subject.id);
  };

  const handleSubjectAdd = (subject: Subject) => {
    setSubjects(prev => [...prev, subject]);
  };

  const handleSubjectUpdate = (updatedSubject: Subject) => {
    setSubjects(prev => prev.map(subject => 
      subject.id === updatedSubject.id ? updatedSubject : subject
    ));
  };

  const handleSubjectDelete = (id: number) => {
    setSubjects(prev => prev.filter(subject => subject.id !== id));
  };

  const handleAssessmentSelect = async (assessment: Assessment) => {
    setSelectedAssessment(assessment);
    setCurrentView('paragraphs');
    setBreadcrumbs([
      { label: 'Subjects', path: 'subjects' },
      { label: selectedSubject?.name || '', path: 'assessments' },
      { label: assessment.name, path: 'paragraphs' }
    ]);
    await loadParagraphs(assessment.id);
  };

  const handleBreadcrumbClick = (path: string) => {
    if (path === 'subjects') {
      setCurrentView('subjects');
      setSelectedSubject(null);
      setSelectedAssessment(null);
      setBreadcrumbs([{ label: 'Subjects', path: 'subjects' }]);
    } else if (path === 'assessments' && selectedSubject) {
      setCurrentView('assessments');
      setSelectedAssessment(null);
      setBreadcrumbs([
        { label: 'Subjects', path: 'subjects' },
        { label: selectedSubject.name, path: 'assessments' }
      ]);
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'subjects':
        return (
          <SubjectsManager
            subjects={subjects}
            onSubjectSelect={handleSubjectSelect}
            onSubjectsChange={loadSubjects}
            onSubjectAdd={handleSubjectAdd}
            onSubjectUpdate={handleSubjectUpdate}
            onSubjectDelete={handleSubjectDelete}
          />
        );
      case 'assessments':
        return selectedSubject ? (
          <AssessmentsManager
            subject={selectedSubject}
            assessments={assessments}
            onAssessmentSelect={handleAssessmentSelect}
            onAssessmentsChange={() => loadAssessments(selectedSubject.id)}
          />
        ) : null;
      case 'paragraphs':
        return selectedAssessment ? (
          <ParagraphsManager
            assessment={selectedAssessment}
            categories={categories}
            paragraphs={paragraphs}
            onParagraphsChange={() => loadParagraphs(selectedAssessment.id)}
          />
        ) : null;
      case 'categories':
        return (
          <CategoriesManager
            categories={categories}
            onCategoriesChange={loadCategories}
          />
        );
      case 'global-paragraphs':
        return (
          <GlobalParagraphsManager
            categories={categories}
            onCategoriesChange={loadCategories}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        <AppBar
          position="fixed"
          sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
        >
          <Toolbar>
            <Typography variant="h6" noWrap component="div">
              Feedback Management System
            </Typography>
          </Toolbar>
        </AppBar>
        
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: {
              width: drawerWidth,
              boxSizing: 'border-box',
            },
          }}
        >
          <Toolbar />
          <Box sx={{ overflow: 'auto' }}>
            <List>
              <ListItem disablePadding>
                <ListItemButton 
                  selected={currentView === 'subjects'}
                  onClick={() => {
                    setCurrentView('subjects');
                    setSelectedSubject(null);
                    setSelectedAssessment(null);
                    setBreadcrumbs([{ label: 'Subjects', path: 'subjects' }]);
                  }}
                >
                  <ListItemText primary="Subjects" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton 
                  selected={currentView === 'categories'}
                  onClick={() => setCurrentView('categories')}
                >
                  <ListItemText primary="Categories" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton 
                  selected={currentView === 'global-paragraphs'}
                  onClick={() => setCurrentView('global-paragraphs')}
                >
                  <ListItemText primary="Paragraph Library" />
                </ListItemButton>
              </ListItem>
            </List>
          </Box>
        </Drawer>
        
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            width: { sm: `calc(100% - ${drawerWidth}px)` },
          }}
        >
          <Toolbar />
          
          <Breadcrumbs sx={{ mb: 2 }}>
            {breadcrumbs.map((crumb) => (
              <Link
                key={crumb.path}
                color="inherit"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handleBreadcrumbClick(crumb.path);
                }}
                sx={{ cursor: 'pointer' }}
              >
                {crumb.label}
              </Link>
            ))}
          </Breadcrumbs>
          
          <Container maxWidth="lg">
            <Paper sx={{ p: 3 }}>
              {renderContent()}
            </Paper>
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
