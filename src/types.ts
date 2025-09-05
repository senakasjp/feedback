export interface Subject {
  id: number;
  name: string;
  created_at: string;
}

export interface Assessment {
  id: number;
  subject_id: number;
  name: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  created_at: string;
}

export interface Paragraph {
  id: number;
  assessment_id: number;
  category_id: number;
  name: string;
  content: string;
  image_path?: string;
  created_at: string;
}

export interface SelectedParagraph extends Paragraph {
  selected: boolean;
}
