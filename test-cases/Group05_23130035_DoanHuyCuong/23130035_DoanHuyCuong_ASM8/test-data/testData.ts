export const ADMIN = {
  path: '/admin2941834',
  username: 'demo',
  password: 'demo1234demo1234',
};

/** Hậu tố duy nhất để mỗi lần chạy tạo dữ liệu không trùng nhau */
export const uid = () => `${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;

export interface ProductData {
  name: string;
  sku: string;
  description: string;
  shortDescription: string;
  weight: string;
  price: string;
  qty: string;
}

export const newProduct = (override: Partial<ProductData> = {}): ProductData => {
  const id = uid();
  return {
    name: `Auto Product ${id}`,
    sku: `AUTO-SKU-${id}`,
    description: 'Mo ta san pham tu dong tao boi Playwright',
    shortDescription: 'Mo ta ngan',
    weight: '1',
    price: '99.99',
    qty: '100',
    ...override,
  };
};

export interface CategoryData {
  name: string;
  description: string;
  urlKey: string;
  metaTitle: string;
  metaDescription: string;
}

export const newCategory = (override: Partial<CategoryData> = {}): CategoryData => {
  const id = uid();
  return {
    name: `Auto Category ${id}`,
    description: 'Mo ta danh muc tu dong',
    urlKey: `auto-category-${id}`,
    metaTitle: `Meta title ${id}`,
    metaDescription: `Meta description ${id}`,
    ...override,
  };
};

export const MESSAGES = {
  loginFail: /invalid (user name|username|login)|incorrect|invalid/i,
  required: /this is a required field/i,
  productSaved: /product has been saved/i,
  productDeleted: /product has been deleted|total of 1 record\(s\) have been deleted/i,
  categorySaved: /category has been saved/i,
  categoryDeleted: /category has been deleted/i,
  noRecords: /no records found/i,
  selectItems: /please select items/i,
};

export const SPECIAL_TEXT = {
  xss: `<script>alert('xss')</script>`,
  special: `!@#$%^&*()_+ Cat`,
  long: 'A'.repeat(300),
};