import React, { useState, useEffect } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { Add, Delete, Edit, ExpandMore } from '@mui/icons-material';
import { invoke } from '@tauri-apps/api/core';
import { Category, Paragraph } from '../types';

// Helper function to get invoke with fallback
const getInvoke = () => {
  // Check if we're in Tauri environment first
  if (typeof window !== 'undefined' && (window as any).__TAURI__) {
    return (window as any).__TAURI__.invoke;
  }
  
  // Fallback to imported invoke
  if (typeof invoke !== 'undefined') {
    return invoke;
  }
  
  // Final fallback
  return (window as any).__TAURI_INVOKE__;
};

interface GlobalParagraphsManagerProps {
  categories: Category[];
  onCategoriesChange: () => void;
}

const GlobalParagraphsManager: React.FC<GlobalParagraphsManagerProps> = ({
  categories,
  onCategoriesChange,
}) => {
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [open, setOpen] = useState(false);
  const [editingParagraph, setEditingParagraph] = useState<Paragraph | null>(null);
  const [paragraphName, setParagraphName] = useState('');
  const [paragraphContent, setParagraphContent] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');
  const [imagePath, setImagePath] = useState('');
  const [loading, setLoading] = useState(false);

  // Load all paragraphs
  const loadAllParagraphs = async () => {
    try {
      setLoading(true);
      const invokeFn = getInvoke();
      
      if (typeof invokeFn === 'undefined') {
        console.warn('Tauri API not available, using mock data');
        setParagraphs([
          {
            id: 1,
            name: 'Sample Paragraph 1',
            content: 'This is a sample paragraph for demonstration.',
            category_id: 1,
            assessment_id: 1,
            image_path: undefined,
            created_at: new Date().toISOString(),
          },
          {
            id: 2,
            name: 'Sample Paragraph 2',
            content: 'Another sample paragraph with different content.',
            category_id: 2,
            assessment_id: 1,
            image_path: undefined,
            created_at: new Date().toISOString(),
          },
        ]);
        return;
      }
      
      // Get all paragraphs across all assessments
      const data = await invokeFn('get_all_paragraphs');
      setParagraphs(data as Paragraph[]);
    } catch (error) {
      console.error('Failed to load paragraphs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllParagraphs();
  }, []);

  const handleOpen = () => {
    setEditingParagraph(null);
    setParagraphName('');
    setParagraphContent('');
    setSelectedCategoryId('');
    setImagePath('');
    setOpen(true);
  };

  const handleEdit = (paragraph: Paragraph) => {
    setEditingParagraph(paragraph);
    setParagraphName(paragraph.name);
    setParagraphContent(paragraph.content);
    setSelectedCategoryId(paragraph.category_id);
    setImagePath(paragraph.image_path || '');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingParagraph(null);
    setParagraphName('');
    setParagraphContent('');
    setSelectedCategoryId('');
    setImagePath('');
  };

  const handleSave = async () => {
    if (!paragraphName.trim() || !paragraphContent.trim() || !selectedCategoryId) return;

    try {
      const invokeFn = getInvoke();
      
      if (typeof invokeFn === 'undefined') {
        console.warn('Tauri API not available, using mock save');
        handleClose();
        return;
      }

      if (editingParagraph) {
        await invokeFn('update_paragraph', {
          id: editingParagraph.id,
          name: paragraphName.trim(),
          content: paragraphContent.trim(),
          categoryId: selectedCategoryId,
          imagePath: imagePath.trim() || null,
        });
      } else {
        // For global paragraphs, we'll use assessment_id = 0 to indicate they're global templates
        await invokeFn('create_paragraph', {
          name: paragraphName.trim(),
          content: paragraphContent.trim(),
          categoryId: selectedCategoryId,
          assessmentId: 0, // 0 indicates global paragraph template
          imagePath: imagePath.trim() || null,
        });
      }
      
      loadAllParagraphs();
      handleClose();
    } catch (error) {
      console.error('Failed to save paragraph:', error);
      alert('Failed to save paragraph: ' + error);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this paragraph?')) {
      try {
        const invokeFn = getInvoke();
        
        if (typeof invokeFn === 'undefined') {
          console.warn('Tauri API not available, using mock delete');
          return;
        }
        
        await invokeFn('delete_paragraph', { id });
        loadAllParagraphs();
      } catch (error) {
        console.error('Failed to delete paragraph:', error);
        alert('Failed to delete paragraph: ' + error);
      }
    }
  };


  const getParagraphsByCategory = () => {
    const grouped: { [key: number]: Paragraph[] } = {};
    paragraphs.forEach(paragraph => {
      if (!grouped[paragraph.category_id]) {
        grouped[paragraph.category_id] = [];
      }
      grouped[paragraph.category_id].push(paragraph);
    });
    return grouped;
  };

  const paragraphsByCategory = getParagraphsByCategory();

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1">
            Paragraph Library
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Manage reusable paragraph templates organized by categories
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleOpen}
        >
          Add Paragraph Template
        </Button>
      </Box>

      {loading ? (
        <Typography>Loading paragraphs...</Typography>
      ) : (
        <Box>
          {categories.map((category) => {
            const categoryParagraphs = paragraphsByCategory[category.id] || [];
            
            return (
              <Accordion key={category.id} defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h6">{category.name}</Typography>
                    <Chip 
                      label={`${categoryParagraphs.length} paragraphs`} 
                      size="small" 
                      color="primary" 
                      variant="outlined"
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {categoryParagraphs.length === 0 ? (
                    <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      No paragraphs in this category yet. Create your first paragraph template.
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      {categoryParagraphs.map((paragraph) => (
                        <Box key={paragraph.id} sx={{ flex: '1 1 300px', minWidth: 300 }}>
                          <Card>
                            <CardContent>
                              <Typography variant="h6" component="div" gutterBottom>
                                {paragraph.name}
                              </Typography>
                              <Typography 
                                variant="body2" 
                                color="text.secondary"
                                sx={{ 
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: 'vertical',
                                  minHeight: '60px'
                                }}
                              >
                                {paragraph.content}
                              </Typography>
                              {paragraph.image_path && (
                                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                                  📷 Image: {paragraph.image_path}
                                </Typography>
                              )}
                              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                                Created: {new Date(paragraph.created_at).toLocaleDateString()}
                              </Typography>
                            </CardContent>
                            <CardActions>
                              <IconButton
                                size="small"
                                onClick={() => handleEdit(paragraph)}
                              >
                                <Edit />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => handleDelete(paragraph.id)}
                                color="error"
                              >
                                <Delete />
                              </IconButton>
                            </CardActions>
                          </Card>
                        </Box>
                      ))}
                    </Box>
                  )}
                </AccordionDetails>
              </Accordion>
            );
          })}

          {categories.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary">
                No categories found. Create categories first to organize your paragraphs.
              </Typography>
              <Button 
                variant="outlined" 
                sx={{ mt: 2 }}
                onClick={onCategoriesChange}
              >
                Manage Categories
              </Button>
            </Box>
          )}
        </Box>
      )}

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingParagraph ? 'Edit Paragraph Template' : 'Add New Paragraph Template'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Paragraph Name"
              fullWidth
              variant="outlined"
              value={paragraphName}
              onChange={(e) => setParagraphName(e.target.value)}
              placeholder="e.g., 'Excellent Communication Skills', 'Areas for Improvement'"
            />
            
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={selectedCategoryId}
                label="Category"
                onChange={(e) => setSelectedCategoryId(e.target.value as number)}
              >
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <TextField
              label="Image Path (optional)"
              fullWidth
              variant="outlined"
              value={imagePath}
              onChange={(e) => setImagePath(e.target.value)}
              placeholder="Path to image file"
            />
            
            <TextField
              label="Content"
              fullWidth
              multiline
              rows={6}
              variant="outlined"
              value={paragraphContent}
              onChange={(e) => setParagraphContent(e.target.value)}
              placeholder="Enter the paragraph template content... This will be reusable across assessments."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button 
            onClick={handleSave} 
            variant="contained"
            disabled={!paragraphName.trim() || !paragraphContent.trim() || !selectedCategoryId}
          >
            {editingParagraph ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GlobalParagraphsManager;

