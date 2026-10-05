export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  if (path === '/admin' || path.startsWith('/admin/')) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
})
