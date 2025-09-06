<script lang="ts">
	import type { Subject, Assessment, BreadcrumbItem } from '../types';

	// Props
	let { 
		currentView = 'subjects',
		currentSubject = null,
		currentAssessment = null,
		onNavigate = () => {}
	}: {
		currentView?: string;
		currentSubject?: Subject | null;
		currentAssessment?: Assessment | null;
		onNavigate?: (view: string, subject?: Subject, assessment?: Assessment) => void;
	} = $props()

	// Breadcrumb items based on current state
	let breadcrumbItems = $derived((): BreadcrumbItem[] => {
		const items: BreadcrumbItem[] = [
			{ 
				label: 'Home', 
				view: 'subjects', 
				active: currentView === 'subjects',
				icon: '🏠'
			}
		];

		// Add subject if we have a current subject
		if (currentSubject) {
			items.push({
				label: currentSubject.name,
				view: 'assessments',
				active: currentView === 'assessments',
				icon: '📚',
				subject: currentSubject
			});
		}

		// Add assessment if we have a current assessment
		if (currentAssessment) {
			items.push({
				label: currentAssessment.name,
				view: 'feedback',
				active: currentView === 'feedback',
				icon: '📝',
				subject: currentSubject,
				assessment: currentAssessment
			});
		}

		return items;
	});

	function handleBreadcrumbClick(item: BreadcrumbItem) {
		if (item.active) return; // Don't navigate if already on this page
		
		onNavigate(item.view, item.subject, item.assessment);
	}
</script>

<nav class="breadcrumb-nav" aria-label="breadcrumb">
	<ol class="breadcrumb">
		{#each breadcrumbItems() as item, index}
			<li class="breadcrumb-item" class:active={item.active}>
				{#if item.active}
					<span class="breadcrumb-current">
						<span class="breadcrumb-icon">{item.icon}</span>
						{item.label}
					</span>
				{:else}
					<button 
						class="breadcrumb-link"
						onclick={() => handleBreadcrumbClick(item)}
						title={`Go to ${item.label}`}
					>
						<span class="breadcrumb-icon">{item.icon}</span>
						{item.label}
					</button>
				{/if}
			</li>
		{/each}
	</ol>
</nav>

<style>
	.breadcrumb-nav {
		background: var(--bs-light);
		border-bottom: 1px solid var(--bs-border-color);
		padding: 0.5rem 0.75rem;
		margin: 0 0 0.75rem 0;
		border-radius: 0.375rem;
	}

	.breadcrumb {
		margin: 0;
		padding: 0;
		background: none;
		font-size: 0.875rem;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.breadcrumb-item {
		display: flex;
		align-items: center;
	}

	.breadcrumb-item:not(:last-child)::after {
		content: "›";
		margin: 0 0.5rem;
		color: var(--bs-secondary);
		font-weight: 500;
	}

	.breadcrumb-link {
		background: none;
		border: none;
		padding: 0.25rem 0.5rem;
		border-radius: 0.375rem;
		color: var(--bs-primary);
		text-decoration: none;
		display: flex;
		align-items: center;
		gap: 0.375rem;
		transition: all 0.2s ease;
		cursor: pointer;
		font-size: inherit;
	}

	.breadcrumb-link:hover {
		background: var(--bs-primary);
		color: white;
		text-decoration: none;
		transform: translateY(-1px);
	}

	.breadcrumb-current {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		color: var(--bs-dark);
		font-weight: 500;
		padding: 0.25rem 0.5rem;
	}

	.breadcrumb-icon {
		font-size: 1rem;
		line-height: 1;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.breadcrumb-nav {
			padding: 0.5rem 0.75rem;
			margin: -0.75rem -0.75rem 0.75rem -0.75rem;
		}
		
		.breadcrumb {
			font-size: 0.8rem;
		}
		
		.breadcrumb-link,
		.breadcrumb-current {
			padding: 0.2rem 0.4rem;
		}
	}
</style>
