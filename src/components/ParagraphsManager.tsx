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
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextareaAutosize,
  Paper,
  Chip,
} from '@mui/material';
import { Add, Delete, Edit, ContentCopy, Print, Person, PhotoCamera } from '@mui/icons-material';
import { invoke } from '@tauri-apps/api/core';

// Extend Window interface to include Tauri
declare global {
  interface Window {
    __TAURI__?: any;
  }
}
import { Assessment, Category, Paragraph, SelectedParagraph } from '../types';

interface ParagraphsManagerProps {
  assessment: Assessment;
  categories: Category[];
  paragraphs: Paragraph[];
  onParagraphsChange: () => void;
}

const ParagraphsManager: React.FC<ParagraphsManagerProps> = ({
  assessment,
  categories,
  paragraphs,
  onParagraphsChange,
}) => {
  const [open, setOpen] = useState(false);
  const [editingParagraph, setEditingParagraph] = useState<Paragraph | null>(null);
  const [paragraphName, setParagraphName] = useState('');
  const [paragraphContent, setParagraphContent] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');
  const [imagePath, setImagePath] = useState('');
  const [selectedParagraphs, setSelectedParagraphs] = useState<SelectedParagraph[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentImage, setStudentImage] = useState<File | null>(null);
  const [studentImagePreview, setStudentImagePreview] = useState<string>('');

  useEffect(() => {
    const selected = paragraphs.map(p => ({
      ...p,
      selected: false
    }));
    setSelectedParagraphs(selected);
  }, [paragraphs]);

  useEffect(() => {
    const selectedContent = selectedParagraphs
      .filter(p => p.selected)
      .map(p => `[${p.name}] ${p.content}`)
      .join('\n\n');
    setSelectedText(selectedContent);
  }, [selectedParagraphs]);

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

  const handleStudentImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setStudentImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setStudentImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearStudentImage = () => {
    setStudentImage(null);
    setStudentImagePreview('');
  };



  const handleSave = async () => {
    if (!paragraphName.trim() || !paragraphContent.trim() || !selectedCategoryId) return;

    try {
      if (editingParagraph) {
        await invoke('update_paragraph', {
          id: editingParagraph.id,
          name: paragraphName.trim(),
          content: paragraphContent.trim(),
          categoryId: selectedCategoryId,
          imagePath: imagePath.trim() || null,
        });
      } else {
        await invoke('create_paragraph', {
          assessmentId: assessment.id,
          name: paragraphName.trim(),
          content: paragraphContent.trim(),
          categoryId: selectedCategoryId,
          imagePath: imagePath.trim() || null,
        });
      }
      onParagraphsChange();
      handleClose();
    } catch (error) {
      console.error('Failed to save paragraph:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this paragraph?')) {
      try {
        await invoke('delete_paragraph', { id });
        onParagraphsChange();
      } catch (error) {
        console.error('Failed to delete paragraph:', error);
      }
    }
  };

  const handleParagraphSelect = (id: number) => {
    setSelectedParagraphs(prev => 
      prev.map(p => 
        p.id === id ? { ...p, selected: !p.selected } : p
      )
    );
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(selectedText);
      // You could add a toast notification here
      alert('Text copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleExportToPDF = async () => {
    console.log('🔵 FRONTEND: Export button clicked');
    console.log('🔵 FRONTEND: Selected text length:', selectedText.length);
    console.log('🔵 FRONTEND: Selected text preview:', selectedText.substring(0, 100));
    console.log('🔵 FRONTEND: Tauri available?', typeof window !== 'undefined' && window.__TAURI__);

    if (!selectedText.trim()) {
      console.log('🔴 FRONTEND: No text selected for export');
      alert('Please select some paragraphs first!');
      return;
    }

    try {
      // Check if we're in Tauri environment
      if (typeof window !== 'undefined' && window.__TAURI__) {
        console.log('🔵 FRONTEND: Tauri environment detected, calling backend');
        const filename = await invoke('export_to_pdf', { 
          content: selectedText,
          studentName: studentName || 'Student Name',
          subject: 'Studio 6', // Default subject name
          assessment: assessment?.name || 'Assessment'
        });
        console.log('✅ FRONTEND: Export successful, filename:', filename);
        alert(`PDF report saved as ${filename} in downloads folder!`);
      } else {
        console.log('🔵 FRONTEND: Browser environment, using fallback method');
        // Fallback: Create and download HTML file directly
        const htmlContent = createHTMLReport(selectedText, studentName || 'Student Name', 'Studio 6', assessment?.name || 'Assessment');
        downloadHTMLFile(htmlContent, 'feedback_report.html');
        console.log('✅ FRONTEND: Fallback export successful');
        alert('Report downloaded as HTML file!\n\nTo convert to PDF: Open the file in your browser and use Print > Save as PDF');
      }
    } catch (error) {
      console.error('🔴 FRONTEND: Failed to export report:', error);
      console.log('🔵 FRONTEND: Trying fallback method...');

      // Fallback: Create and download HTML file directly
      try {
        const htmlContent = createHTMLReport(selectedText, studentName || 'Student Name', 'Studio 6', assessment?.name || 'Assessment');
        downloadHTMLFile(htmlContent, 'feedback_report.html');
        console.log('✅ FRONTEND: Fallback export successful');
        alert('Report downloaded as HTML file!\n\nTo convert to PDF: Open the file in your browser and use Print > Save as PDF');
      } catch (fallbackError) {
        console.error('🔴 FRONTEND: Fallback also failed:', fallbackError);
        alert('Failed to export report: ' + error);
      }
    }
  };

  // Helper function to create HTML report
  const createHTMLReport = (content: string, studentName: string, subject: string, assessment: string): string => {
    const contentHtml = content
      .split('\n')
      .map(line => line.trim() === '' ? '<br>' : `<p>${escapeHtml(line)}</p>`)
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Feedback Report</title>
    <style>
        @media print {
            @page {
                margin: 1in;
                size: A4;
            }
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
            }
        }
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .title {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .info-section {
            margin: 20px 0;
            padding: 15px;
            background-color: #f5f5f5;
            border-radius: 5px;
        }
        .info-row {
            margin: 8px 0;
            display: flex;
        }
        .info-label {
            font-weight: bold;
            width: 100px;
            flex-shrink: 0;
        }
        .content {
            font-size: 14px;
        }
        .content p {
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">FEEDBACK REPORT</div>
    </div>
    <hr style="margin: 20px 0; border: 1px solid #ccc;">
    <div class="image-section" style="text-align: center; margin: 20px 0;">
        <div style="border: 2px dashed #ccc; padding: 20px; display: inline-block; min-width: 200px; min-height: 150px; display: flex; align-items: center; justify-content: center; color: #666;">
            Student Photo: [Image would appear here]
        </div>
    </div>
    <div class="info-section">
        <div class="info-row">
            <span class="info-label">Student:</span>
            <span>${escapeHtml(studentName)}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Subject:</span>
            <span>${escapeHtml(subject)}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Assessment:</span>
            <span>${escapeHtml(assessment)}</span>
        </div>
    </div>
    <div class="content">
        ${contentHtml}
    </div>
    <script>
        // Auto-print when opened
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 1000);
        };
    </script>
</body>
</html>`;
  };

  // Helper function to escape HTML
  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  };

  // Helper function to download HTML file
  const downloadHTMLFile = (content: string, filename: string): void => {
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getCategoryName = (categoryId: number) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Unknown';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Paragraphs for {assessment.name}
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleOpen}
        >
          Add Paragraph
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Person />
            Student Information
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1 }}>
              <TextField
                label="Student Name"
                fullWidth
                variant="outlined"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Enter student name"
                sx={{ mb: 2 }}
              />
            </Box>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <Box sx={{ position: 'relative' }}>
                {studentImagePreview ? (
                  <Box
                    component="img"
                    src={studentImagePreview}
                    alt="Student preview"
                    sx={{
                      width: 120,
                      height: 120,
                      objectFit: 'cover',
                      borderRadius: 1,
                      border: '2px solid #e0e0e0'
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: 120,
                      height: 120,
                      border: '2px dashed #e0e0e0',
                      borderRadius: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'text.secondary',
                      gap: 1
                    }}
                  >
                    <PhotoCamera />
                    <Typography variant="caption">No image</Typography>
                  </Box>
                )}
              </Box>
              
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<PhotoCamera />}
                  size="small"
                >
                  Upload Image
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleStudentImageChange}
                  />
                </Button>
                {studentImage && (
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={clearStudentImage}
                  >
                    Clear
                  </Button>
                )}
              </Box>
            </Box>
          </Box>
        </Paper>

        <Box>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Paragraphs ({paragraphs.length})
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {selectedParagraphs.map((paragraph) => (
              <Card key={paragraph.id} sx={{ 
                border: paragraph.selected ? '2px solid' : '1px solid',
                borderColor: paragraph.selected ? 'primary.main' : 'divider'
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Checkbox
                      checked={paragraph.selected}
                      onChange={() => handleParagraphSelect(paragraph.id)}
                    />
                    <Box sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="h6" component="div">
                          {paragraph.name}
                        </Typography>
                        <Chip 
                          label={getCategoryName(paragraph.category_id)} 
                          size="small" 
                          color="primary" 
                          variant="outlined"
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {paragraph.content}
                      </Typography>
                      {paragraph.image_path && (
                        <Typography variant="caption" color="text.secondary">
                          Image: {paragraph.image_path}
                        </Typography>
                      )}
                    </Box>
                  </Box>
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
            ))}
          </Box>

          {paragraphs.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary">
                No paragraphs found. Create your first paragraph to get started.
              </Typography>
            </Box>
          )}
        </Box>

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Selected Content
          </Typography>
          
          <TextareaAutosize
            minRows={8}
            maxRows={15}
            value={selectedText}
            readOnly
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontFamily: 'inherit',
              fontSize: '14px',
              resize: 'vertical'
            }}
            placeholder="Select paragraphs to see their content here..."
          />
          
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<ContentCopy />}
              onClick={handleCopyToClipboard}
              disabled={!selectedText.trim()}
              fullWidth
            >
              Copy to Clipboard
            </Button>
            <Button
              variant="outlined"
              startIcon={<Print />}
              onClick={handleExportToPDF}
              disabled={!selectedText.trim()}
              fullWidth
            >
              📄 Export PDF
            </Button>
          </Box>
        </Paper>
      </Box>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingParagraph ? 'Edit Paragraph' : 'Add New Paragraph'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Paragraph Name"
              fullWidth
              variant="outlined"
              value={paragraphName}
              onChange={(e) => setParagraphName(e.target.value)}
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
              placeholder="Enter paragraph content..."
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

export default ParagraphsManager;
