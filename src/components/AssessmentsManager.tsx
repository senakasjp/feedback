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
  Card,
  CardContent,
  CardActions,
  IconButton,
} from '@mui/material';
import { Add, Delete, Edit } from '@mui/icons-material';
import { invoke } from '@tauri-apps/api/core';
import { Subject, Assessment } from '../types';

interface AssessmentsManagerProps {
  subject: Subject;
  assessments: Assessment[];
  onAssessmentSelect: (assessment: Assessment) => void;
  onAssessmentsChange: () => void;
}

const AssessmentsManager: React.FC<AssessmentsManagerProps> = ({
  subject,
  assessments,
  onAssessmentSelect,
  onAssessmentsChange,
}) => {
  const [open, setOpen] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null);
  const [assessmentName, setAssessmentName] = useState('');

  const handleOpen = () => {
    setEditingAssessment(null);
    setAssessmentName('');
    setOpen(true);
  };

  const handleEdit = (assessment: Assessment) => {
    setEditingAssessment(assessment);
    setAssessmentName(assessment.name);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingAssessment(null);
    setAssessmentName('');
  };

  const handleSave = async () => {
    if (!assessmentName.trim()) return;

    try {
      if (editingAssessment) {
        await invoke('update_assessment', {
          id: editingAssessment.id,
          name: assessmentName.trim(),
        });
      } else {
        await invoke('create_assessment', {
          subjectId: subject.id,
          name: assessmentName.trim(),
        });
      }
      onAssessmentsChange();
      handleClose();
    } catch (error) {
      console.error('Failed to save assessment:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this assessment? This will also delete all associated paragraphs.')) {
      try {
        await invoke('delete_assessment', { id });
        onAssessmentsChange();
      } catch (error) {
        console.error('Failed to delete assessment:', error);
      }
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1">
            Assessments for {subject.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Manage assessments under this subject
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleOpen}
        >
          Add Assessment
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {assessments.map((assessment) => (
          <Card key={assessment.id} sx={{ minWidth: 300, maxWidth: 400 }}>
            <CardContent>
              <Typography variant="h6" component="div">
                {assessment.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Created: {new Date(assessment.created_at).toLocaleDateString()}
              </Typography>
            </CardContent>
            <CardActions>
              <Button
                size="small"
                onClick={() => onAssessmentSelect(assessment)}
              >
                View Paragraphs
              </Button>
              <IconButton
                size="small"
                onClick={() => handleEdit(assessment)}
              >
                <Edit />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => handleDelete(assessment.id)}
                color="error"
              >
                <Delete />
              </IconButton>
            </CardActions>
          </Card>
        ))}
      </Box>

      {assessments.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary">
            No assessments found. Create your first assessment to get started.
          </Typography>
        </Box>
      )}

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingAssessment ? 'Edit Assessment' : 'Add New Assessment'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Assessment Name"
            fullWidth
            variant="outlined"
            value={assessmentName}
            onChange={(e) => setAssessmentName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSave();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {editingAssessment ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AssessmentsManager;
