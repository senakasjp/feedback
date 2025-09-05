import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import { Add, Delete, Edit } from '@mui/icons-material';
import { invoke } from '@tauri-apps/api/core';

// Helper function to get invoke with fallback
const getInvoke = () => {
  // Try imported invoke first (this should work in Tauri desktop)
  if (typeof invoke !== 'undefined') {
    return invoke;
  }
  
  // Check if we're in Tauri environment via global API
  if (typeof window !== 'undefined' && (window as any).__TAURI__) {
    return (window as any).__TAURI__.invoke;
  }
  
  // Final fallback
  return (window as any).__TAURI_INVOKE__;
};
import { Subject } from '../types';

interface SubjectsManagerProps {
  subjects: Subject[];
  onSubjectSelect: (subject: Subject) => void;
  onSubjectsChange: () => void;
  onSubjectAdd?: (subject: Subject) => void;
  onSubjectUpdate?: (subject: Subject) => void;
  onSubjectDelete?: (id: number) => void;
}

const SubjectsManager: React.FC<SubjectsManagerProps> = ({
  subjects,
  onSubjectSelect,
  onSubjectsChange,
  onSubjectAdd,
  onSubjectUpdate,
}) => {
  const [open, setOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectName, setSubjectName] = useState('');

  const handleOpen = () => {
    console.log('Add Subject button clicked');
    setEditingSubject(null);
    setSubjectName('');
    setOpen(true);
  };

  const testTauriAPI = async () => {
    try {
      console.log('Testing Tauri API...');
      
      // Get invoke function with fallback
      const invokeFn = getInvoke();
      
      // Check if Tauri API is available
      if (typeof invokeFn === 'undefined') {
        console.warn('Tauri API is not available - running in browser mode');
        alert('Tauri API is not available - running in browser mode. This is normal when testing in a web browser.');
        return;
      }
      
      const result = await invokeFn('get_subjects');
      console.log('Tauri API test successful:', result);
      alert('Tauri API is working! Check console for details.');
    } catch (error) {
      console.error('Tauri API test failed:', error);
      alert('Tauri API test failed: ' + error);
    }
  };

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setSubjectName(subject.name);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingSubject(null);
    setSubjectName('');
  };

  const handleSave = async () => {
    if (!subjectName.trim()) return;

    try {
      console.log('Attempting to save subject:', subjectName.trim());
      
      // Get invoke function with fallback
      const invokeFn = getInvoke();
      
      // Check if Tauri API is available
      if (typeof invokeFn === 'undefined') {
        console.warn('Tauri API not available, using mock save');
        // Mock save for browser testing
        const mockSubject = {
          id: Date.now(),
          name: subjectName.trim(),
          created_at: new Date().toISOString()
        };
        console.log('Mock subject created:', mockSubject);
        
        if (editingSubject) {
          // Update existing subject
          if (onSubjectUpdate) {
            onSubjectUpdate({ ...editingSubject, name: subjectName.trim() });
          }
        } else {
          // Add new subject
          if (onSubjectAdd) {
            onSubjectAdd(mockSubject);
          }
        }
        
        handleClose();
        return;
      }
      
      if (editingSubject) {
        console.log('Updating subject with ID:', editingSubject.id);
        await invokeFn('update_subject', {
          id: editingSubject.id,
          name: subjectName.trim(),
        });
      } else {
        console.log('Creating new subject');
        const result = await invokeFn('create_subject', {
          name: subjectName.trim(),
        });
        console.log('Subject created with ID:', result);
      }
      onSubjectsChange();
      handleClose();
    } catch (error) {
      console.error('Failed to save subject:', error);
      alert('Failed to save subject: ' + error);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this subject? This will also delete all associated assessments and paragraphs.')) {
      try {
        console.log('🔴 Frontend: Attempting to delete subject with ID:', id);
        console.log('🔴 Frontend: invoke function imported:', typeof invoke);
        
        // Direct call to imported invoke function (should work in Tauri)
        console.log('🔴 Frontend: Calling delete_subject directly...');
        await invoke('delete_subject', { id });
        console.log('🔴 Frontend: Delete command completed successfully');
        
        console.log('🔴 Frontend: Refreshing subjects list...');
        onSubjectsChange();
        console.log('🔴 Frontend: Delete process completed');
      } catch (error) {
        console.error('🔴 Frontend: Failed to delete subject:', error);
        alert('Failed to delete subject: ' + error);
      }
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Subjects
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={testTauriAPI}
          >
            Test API
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleOpen}
          >
            Add Subject
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {subjects.map((subject) => (
          <Card key={subject.id} sx={{ minWidth: 300, maxWidth: 400 }}>
            <CardContent>
              <Typography variant="h6" component="div">
                {subject.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Created: {new Date(subject.created_at).toLocaleDateString()}
              </Typography>
            </CardContent>
            <CardActions>
              <Button
                size="small"
                onClick={() => onSubjectSelect(subject)}
              >
                View Assessments
              </Button>
              <IconButton
                size="small"
                onClick={() => handleEdit(subject)}
              >
                <Edit />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => handleDelete(subject.id)}
                color="error"
              >
                <Delete />
              </IconButton>
            </CardActions>
          </Card>
        ))}
      </Box>

      {subjects.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary">
            No subjects found. Create your first subject to get started.
          </Typography>
        </Box>
      )}

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingSubject ? 'Edit Subject' : 'Add New Subject'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Subject Name"
            fullWidth
            variant="outlined"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSave();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button 
            onClick={() => {
              console.log('Create/Update button clicked');
              handleSave();
            }} 
            variant="contained"
          >
            {editingSubject ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SubjectsManager;
