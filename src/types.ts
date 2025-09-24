export interface Subject {
	id: string;
	name: string;
	assessments: Assessment[];
}

export interface Assessment {
	id: string;
	name: string;
	topics: Topic[];
	categories: Category[];
	knowledgeAreas: string[];
	weight?: number;
	headerPhoto?: string;
}

export interface Topic {
	id: string;
	name: string;
	description?: string;
}

export interface Category {
	id: string;
	name: string;
	description?: string;
	knowledgeArea?: string;
	allocatedMarks?: number;
	order?: number;
}

export interface Paragraph {
	id: string;
	text: string;
	topicId?: string;
	categoryId?: string;
	order: number;
}

export interface OrderedParagraph {
	id: string;
	text: string;
	topicId?: string;
	categoryId?: string;
	order: number;
	topicName?: string;
	categoryName?: string;
}

export interface BreadcrumbItem {
	label: string;
	view: string;
	active: boolean;
	icon: string;
	subject?: Subject;
	assessment?: Assessment;
}
