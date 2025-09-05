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
import { Category } from '../types';

interface CategoriesManagerProps {
  categories: Category[];
  onCategoriesChange: () => void;
}

const CategoriesManager: React.FC<CategoriesManagerProps> = ({
  categories,
  onCategoriesChange,
}) => {
  const [open, setOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');

  const handleOpen = () => {
    setEditingCategory(null);
    setCategoryName('');
    setOpen(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingCategory(null);
    setCategoryName('');
  };

  const handleSave = async () => {
    if (!categoryName.trim()) return;

    try {
      if (editingCategory) {
        await invoke('update_category', {
          id: editingCategory.id,
          name: categoryName.trim(),
        });
      } else {
        await invoke('create_category', {
          name: categoryName.trim(),
        });
      }
      onCategoriesChange();
      handleClose();
    } catch (error) {
      console.error('Failed to save category:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this category? This will affect all paragraphs using this category.')) {
      try {
        await invoke('delete_category', { id });
        onCategoriesChange();
      } catch (error) {
        console.error('Failed to delete category:', error);
      }
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Categories
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleOpen}
        >
          Add Category
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {categories.map((category) => (
          <Card key={category.id} sx={{ minWidth: 200, maxWidth: 300 }}>
            <CardContent>
              <Typography variant="h6" component="div">
                {category.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Created: {new Date(category.created_at).toLocaleDateString()}
              </Typography>
            </CardContent>
            <CardActions>
              <IconButton
                size="small"
                onClick={() => handleEdit(category)}
              >
                <Edit />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => handleDelete(category.id)}
                color="error"
              >
                <Delete />
              </IconButton>
            </CardActions>
          </Card>
        ))}
      </Box>

      {categories.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary">
            No categories found. Create your first category to organize paragraphs.
          </Typography>
        </Box>
      )}

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCategory ? 'Edit Category' : 'Add New Category'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Category Name"
            fullWidth
            variant="outlined"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
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
            {editingCategory ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CategoriesManager;
