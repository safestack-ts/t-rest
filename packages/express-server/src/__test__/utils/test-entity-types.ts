export type User = {
  id: number;
  email: string;
};

export type Person = {
  id: number;
  name: string;
};

export type BasketEntry = {
  id: string;
  productName: string;
  quantity: number;
};

export type Basket = {
  id: string;
  entries: BasketEntry[];
};
