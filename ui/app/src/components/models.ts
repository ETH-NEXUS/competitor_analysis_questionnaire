export interface Todo {
  id: number;
  content: string;
}

export interface Meta {
  totalCount: number;
}

export interface Author {
  id: number,
  name: string,
  date_of_birth?: string
  date_of_death?: string
}

export interface Book {
  id: number,
  title: string,
  author?: Author
}
