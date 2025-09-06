<script lang="ts">
    // Types
    type Category = {
        id: string;
        name: string;
        description?: string;
    }

    // Props
    let { categories = $bindable() }: { categories?: Category[] } = $props()

    // Local state
    let newCategoryName = $state('');
    let newCategoryDescription = $state('');

    // Functions
    function addCategory() {
        if (newCategoryName.trim()) {
            categories = [...categories, {
                id: Date.now().toString(),
                name: newCategoryName.trim(),
                description: newCategoryDescription.trim() || undefined
            }];
            
            newCategoryName = '';
            newCategoryDescription = '';
        }
    }

    function deleteCategory(categoryId: string) {
        categories = categories.filter(cat => cat.id !== categoryId);
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            addCategory();
        }
    }
</script>

<div class="category-editor">
    <div class="alert alert-info mb-2">
        <small><strong>CategoryEditor Debug:</strong> categories.length = {categories?.length || 0}</small>
    </div>
    <div class="category-header d-flex justify-content-between align-items-center mb-3">
        <h6 class="section-title mb-0">Categories</h6>
        <small class="text-muted">{categories?.length || 0} category{(categories?.length || 0) !== 1 ? 's' : ''}</small>
    </div>

    <div class="category-input-form mb-3">
        <div class="add-category-header mb-3">
            <h6 class="mb-0">Add New Category</h6>
        </div>
        
        <div class="form-fields">
            <div class="form-group mb-3">
                <label for="category-name" class="form-label">Category Name *</label>
                <input
                    id="category-name"
                    type="text"
                    class="form-control"
                    placeholder="e.g., Writing Skills, Math Concepts"
                    bind:value={newCategoryName}
                    onkeydown={handleKeydown}
                >
            </div>
            
            <div class="form-group mb-3">
                <label for="category-description" class="form-label">Description (Optional)</label>
                <input
                    id="category-description"
                    type="text"
                    class="form-control"
                    placeholder="Brief description of this category"
                    bind:value={newCategoryDescription}
                    onkeydown={handleKeydown}
                >
            </div>
            
            <div class="form-actions">
                <button 
                    class="btn btn-primary"
                    onclick={addCategory}
                    disabled={!newCategoryName.trim()}
                >
                    <span class="me-2">+</span>Add Category
                </button>
            </div>
        </div>
    </div>

    {#if categories.length > 0}
        <div class="categories-stack">
            <div class="stack-header mb-3">
                <h6 class="mb-0">Your Categories</h6>
                <small class="text-muted">{categories.length} category{categories.length !== 1 ? 's' : ''} created</small>
            </div>
            <div class="categories-list">
                {#each categories as category, index}
                    <div class="category-card" style="z-index: {categories.length - index};">
                        <div class="category-content">
                            <div class="category-info">
                                <div class="category-name">{category.name}</div>
                                {#if category.description}
                                    <div class="category-description">{category.description}</div>
                                {/if}
                            </div>
                            <button 
                                class="btn btn-sm btn-outline-danger delete-btn"
                                onclick={() => deleteCategory(category.id)}
                                title="Delete category"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {:else}
        <div class="empty-state text-center py-3">
            <p class="text-muted small mb-0">No categories added yet</p>
            <small class="text-muted">Add categories to organize your feedback</small>
        </div>
    {/if}
</div>

<!-- Styles are now in components.css -->
