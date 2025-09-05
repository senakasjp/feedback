import React, { useState, useEffect } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ListSubheader,
} from '@mui/material';
import { Add, Preview } from '@mui/icons-material';
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

interface ParagraphSelectorProps {
  value?: number | number[];
  onChange: (value: number | number[]) => void;
  categories: Category[];
  multiple?: boolean;
  label?: string;
  placeholder?: string;
  allowCreate?: boolean;
  onCreateNew?: () => void;
}

const ParagraphSelector: React.FC<ParagraphSelectorProps> = ({
  value,
  onChange,
  categories,
  multiple = false,
  label = "Select Paragraph(s)",
  placeholder = "Choose from paragraph library...",
  allowCreate = false,
  onCreateNew,
}) => {
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewParagraph, setPreviewParagraph] = useState<Paragraph | null>(null);
  const [loading, setLoading] = useState(false);

  const loadParagraphs = async () => {
    try {
      setLoading(true);
      const invokeFn = getInvoke();
      
      if (typeof invokeFn === 'undefined') {
        console.warn('Tauri API not available, using mock data');
        setParagraphs([
          {
            id: 1,
            name: 'Excellent Communication',
            content: 'The student demonstrates excellent communication skills both verbally and in writing.',
            category_id: 1,
            assessment_id: 0,
            image_path: undefined,
            created_at: new Date().toISOString(),
          },
          {
            id: 2,
            name: 'Needs Improvement',
            content: 'This area requires additional focus and practice to meet expectations.',
            category_id: 2,
            assessment_id: 0,
            image_path: undefined,
            created_at: new Date().toISOString(),
          },
          {
            id: 3,
            name: 'Strong Problem Solving',
            content: 'Shows exceptional ability to analyze problems and develop creative solutions.',
            category_id: 1,
            assessment_id: 0,
            image_path: undefined,
            created_at: new Date().toISOString(),
          },
        ]);
        return;
      }
      
      const data = await invokeFn('get_all_paragraphs');
      setParagraphs(data as Paragraph[]);
    } catch (error) {
      console.error('Failed to load paragraphs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParagraphs();
  }, []);

  const getCategoryName = (categoryId: number) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Unknown';
  };

  const handlePreview = (paragraph: Paragraph) => {
    setPreviewParagraph(paragraph);
    setPreviewOpen(true);
  };

  const renderValue = (selected: any) => {
    if (multiple) {
      const selectedIds = Array.isArray(selected) ? selected : [];
      if (selectedIds.length === 0) return <em>{placeholder}</em>;
      
      return (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {selectedIds.map((id: number) => {
            const paragraph = paragraphs.find(p => p.id === id);
            return paragraph ? (
              <Chip key={id} label={paragraph.name} size="small" />
            ) : null;
          })}
        </Box>
      );
    } else {
      const paragraph = paragraphs.find(p => p.id === selected);
      return paragraph ? paragraph.name : <em>{placeholder}</em>;
    }
  };

  // Group paragraphs by category
  const paragraphsByCategory = paragraphs.reduce((acc, paragraph) => {
    if (!acc[paragraph.category_id]) {
      acc[paragraph.category_id] = [];
    }
    acc[paragraph.category_id].push(paragraph);
    return acc;
  }, {} as { [key: number]: Paragraph[] });

  return (
    <>
      <FormControl fullWidth>
        <InputLabel>{label}</InputLabel>
        <Select
          value={value || (multiple ? [] : '')}
          label={label}
          onChange={(e) => onChange(e.target.value as number | number[])}
          multiple={multiple}
          renderValue={renderValue}
          MenuProps={{
            PaperProps: {
              style: {
                maxHeight: 400,
              },
            },
          }}
        >
          {loading ? (
            <MenuItem disabled>
              <Typography>Loading paragraphs...</Typography>
            </MenuItem>
          ) : (
            <>
              {allowCreate && onCreateNew && (
                <>
                  <MenuItem onClick={onCreateNew}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
                      <Add />
                      <Typography>Create New Paragraph</Typography>
                    </Box>
                  </MenuItem>
                  {paragraphs.length > 0 && <ListSubheader>Available Paragraphs</ListSubheader>}
                </>
              )}
              
              {categories.map((category) => {
                const categoryParagraphs = paragraphsByCategory[category.id] || [];
                if (categoryParagraphs.length === 0) return null;
                
                return [
                  <ListSubheader key={`header-${category.id}`}>
                    {category.name} ({categoryParagraphs.length})
                  </ListSubheader>,
                  ...categoryParagraphs.map((paragraph) => (
                    <MenuItem key={paragraph.id} value={paragraph.id}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                            {paragraph.name}
                          </Typography>
                          <Typography 
                            variant="caption" 
                            color="text.secondary"
                            sx={{
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '300px'
                            }}
                          >
                            {paragraph.content}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreview(paragraph);
                          }}
                          sx={{ ml: 1 }}
                        >
                          <Preview fontSize="small" />
                        </Button>
                      </Box>
                    </MenuItem>
                  ))
                ];
              })}
              
              {paragraphs.length === 0 && !loading && (
                <MenuItem disabled>
                  <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    No paragraphs available. Create some in the Paragraph Library.
                  </Typography>
                </MenuItem>
              )}
            </>
          )}
        </Select>
      </FormControl>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {previewParagraph?.name}
        </DialogTitle>
        <DialogContent>
          {previewParagraph && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Category: {getCategoryName(previewParagraph.category_id)}
              </Typography>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {previewParagraph.content}
              </Typography>
              {previewParagraph.image_path && (
                <Typography variant="caption" display="block" sx={{ mt: 2 }}>
                  📷 Image: {previewParagraph.image_path}
                </Typography>
              )}
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                Created: {new Date(previewParagraph.created_at).toLocaleDateString()}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ParagraphSelector;

