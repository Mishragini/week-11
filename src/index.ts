import { Context, Hono,Next } from 'hono';

import { PrismaClient } from '@prisma/client/edge'

import { withAccelerate } from '@prisma/extension-accelerate'

import jwt from 'jsonwebtoken';

const prisma = new PrismaClient({
  datasourceUrl:"prisma://accelerate.prisma-data.net/?api_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcGlfa2V5IjoiMDVmZmRhOGQtYWE2NS00M2RmLWJmMGEtMzExZTY0NTE0OThmIiwidGVuYW50X2lkIjoiMGE4OWZjYjI3M2U4NmMwZjFjNzQ2M2MyNjVjNjJlZmYwY2NlNzMzZTYxNWQzYjI1ZDc0NGU0MWQ5OTM0Y2YwYyIsImludGVybmFsX3NlY3JldCI6ImQwNjAzMjQ3LTc5NDEtNDcwMC1iZjRjLTIxYTRjNWYxMWZlZCJ9.Cym9yqtJrFl_OpwW9eSZy4zjgsGGLNTisuRASsRQIQc"
 ,
}).$extends(withAccelerate())

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})



declare module 'hono' {
  interface Context {
    userId: number;
  }
}

const secretKey="hakuna matata";


const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('authorization');

  if (!authHeader) {
    return c.json({ message: 'Unauthorized: Missing Authorization header' }, 401);
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return c.json({ message: 'Unauthorized: Missing token in Authorization header' }, 401);
  }

  try {
    const decoded = jwt.verify(token, secretKey) as { email: string };
    const user = await prisma.user.findFirst({ where: { email: decoded.email } });

    if (!user) {
      return; 
    }

    c.userId = user.id;
    await next();
  } catch (error) {
    return c.json({ message: 'Unauthorized: Invalid token' }, 401);
  }
};

app.get('/', (c) => {
  return c.text('Hello Hono!');
});

app.post('/users/signup', async (c) => {
  const body = await c.req.json();
  const { email, username, password } = body;
  const user = await prisma.user.findFirst({ where: { email } });

  if (user) {
    return c.json({ message: 'email already in use' });
  }

  const newUser = await prisma.user.create({ data: { email, username, password } });
  const token = jwt.sign({ email }, secretKey, { expiresIn: '1h' });

  return c.json({ message: 'User created successfully',token });
});

app.post('/users/signin', async (c) => {
  const body = await c.req.json();
  const { email, password } = body;
  const user = await prisma.user.findFirst({ where: { email } });

  if (!user || user.password !== password) {
    return c.json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ email }, secretKey, { expiresIn: '1h' });

  return c.json({ message: 'Signed in successfully',token });
});

app.get('/posts', authMiddleware, async (c) => {
  const userId = c.userId;

  const allBlogs = await prisma.blog.findMany({});
  const userSpecificBlog = await prisma.blog.findMany({ where: { authorId:userId } });

  if (!allBlogs) c.json({ message: 'no blogs found' });
  if (!userSpecificBlog) c.json({ message: 'no blogs by user' });

  c.json({ allBlogs, userSpecificBlog });
});

app.post('/posts', authMiddleware, async (c) => {
  const { title, content } = await c.req.json();
  const userId = c.userId;

  const newBlog = await prisma.blog.create({
    data: { title, description:content, author: { connect: { id: userId } } },
  });

  c.json({ message: 'Blog added successfully', id: newBlog.id });
});

app.delete('/posts/:id', authMiddleware, async (c) => {
  const blogId = parseInt(c.req.param('id'));

  const blogToDelete = await prisma.blog.delete({ where: { id: blogId } });

  c.json({ message: 'Blog deleted successfully' });
});

export default app;