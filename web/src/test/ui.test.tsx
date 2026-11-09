import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { apiError, dashboardOk, jsonResponse, mockFetch, renderApp, signIn, TOKEN, URL_ITEM, USER } from './helpers';

const session = () => localStorage.getItem('snap.session');

describe('autenticación y rutas', () => {
  it('sin token, /dashboard redirige a /login', async () => {
    mockFetch(dashboardOk);
    renderApp('/dashboard');
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('con sesión, /login redirige al dashboard', async () => {
    signIn();
    mockFetch(dashboardOk);
    renderApp('/login');
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('login correcto guarda token y usuario y entra al dashboard', async () => {
    const calls = mockFetch((url) =>
      url === '/auth/login' ? jsonResponse(200, { user: USER, token: TOKEN }) : dashboardOk(url, {}),
    );
    renderApp('/login');
    await userEvent.type(screen.getByLabelText('Email'), 'ana@test.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secreto123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(JSON.parse(session()!)).toEqual({ user: USER, token: TOKEN });
    expect(calls[0]!.url).toBe('/auth/login');
  });

  it('LOGOUT: borra token y usuario de localStorage y vuelve a /login', async () => {
    signIn();
    mockFetch(dashboardOk);
    renderApp('/dashboard');
    await screen.findByRole('table');
    expect(session()).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(session()).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('tras el logout, /dashboard ya no es accesible', async () => {
    signIn();
    mockFetch(dashboardOk);
    const { unmount } = renderApp('/dashboard');
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    unmount();
    renderApp('/dashboard');
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('token caducado (401 en ruta protegida): limpia la sesión y redirige a /login', async () => {
    signIn();
    mockFetch(() => apiError(401, 'unauthorized', 'Token inválido o expirado'));
    renderApp('/dashboard');
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(session()).toBeNull();
  });

  it('las peticiones protegidas llevan Authorization: Bearer', async () => {
    signIn();
    const calls = mockFetch(dashboardOk);
    renderApp('/dashboard');
    await screen.findByRole('table');
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect((c.init.headers as Record<string, string>)['Authorization']).toBe(`Bearer ${TOKEN}`);
    }
  });
});

describe('errores visibles para el usuario', () => {
  it('login con credenciales erróneas muestra el mensaje y NO cierra ni crea sesión', async () => {
    mockFetch(() => apiError(401, 'unauthorized', 'Credenciales inválidas'));
    renderApp('/login');
    await userEvent.type(screen.getByLabelText('Email'), 'ana@test.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'mala');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas');
    expect(session()).toBeNull();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  it('login con campos vacíos avisa sin llamar a la API', async () => {
    const calls = mockFetch(dashboardOk);
    renderApp('/login');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Introduce tu email y contraseña');
    expect(calls).toHaveLength(0);
  });

  it('registro con email duplicado muestra el 409 del servidor', async () => {
    mockFetch(() => apiError(409, 'conflict', 'El email ya está registrado'));
    renderApp('/register');
    await userEvent.type(screen.getByLabelText('Nombre'), 'Ana');
    await userEvent.type(screen.getByLabelText('Email'), 'ana@test.com');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'secreto123');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El email ya está registrado');
  });

  it('registro con contraseña corta se valida en el cliente', async () => {
    const calls = mockFetch(dashboardOk);
    renderApp('/register');
    await userEvent.type(screen.getByLabelText('Nombre'), 'Ana');
    await userEvent.type(screen.getByLabelText('Email'), 'ana@test.com');
    await userEvent.type(screen.getByLabelText(/Contraseña/), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(screen.getByRole('alert')).toHaveTextContent('al menos 8 caracteres');
    expect(calls).toHaveLength(0);
  });

  it('sin conexión muestra un mensaje claro', async () => {
    mockFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    renderApp('/login');
    await userEvent.type(screen.getByLabelText('Email'), 'ana@test.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secreto123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor');
  });

  it('servidor caído (500 sin JSON) no enseña "Error inesperado (500)" crudo', async () => {
    mockFetch(() => jsonResponse(500));
    renderApp('/login');
    await userEvent.type(screen.getByLabelText('Email'), 'ana@test.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secreto123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El servidor no está disponible');
  });

  it('crear con alias repetido muestra el 409 y conserva lo escrito', async () => {
    signIn();
    mockFetch((url, init) =>
      init.method === 'POST' ? apiError(409, 'conflict', 'El alias ya está en uso') : dashboardOk(url, init),
    );
    renderApp('/dashboard');
    await screen.findByRole('table');
    await userEvent.type(screen.getByLabelText('URL a acortar'), 'https://example.com/');
    await userEvent.type(screen.getByLabelText(/Alias/), 'wiki');
    await userEvent.click(screen.getByRole('button', { name: 'Acortar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El alias ya está en uso');
    expect(screen.getByLabelText('URL a acortar')).toHaveValue('https://example.com/');
  });

  it('alias inválido se rechaza en el cliente sin llamar a la API', async () => {
    signIn();
    const calls = mockFetch(dashboardOk);
    renderApp('/dashboard');
    await screen.findByRole('table');
    const before = calls.length;
    await userEvent.type(screen.getByLabelText('URL a acortar'), 'https://example.com/');
    await userEvent.type(screen.getByLabelText(/Alias/), 'a b');
    await userEvent.click(screen.getByRole('button', { name: 'Acortar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('El alias debe tener entre 3 y 32');
    expect(calls).toHaveLength(before);
  });

  it('error al cargar el listado ofrece reintentar', async () => {
    signIn();
    let fail = true;
    mockFetch((url, init) => (fail ? apiError(500, 'internal_error', 'Error interno del servidor') : dashboardOk(url, init)));
    renderApp('/dashboard');
    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno del servidor');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByText(URL_ITEM.shortUrl.replace('http://', ''))).toBeInTheDocument());
  });
});

describe('dashboard', () => {
  it('crea una URL con alias: envía {url, alias}, muestra confirmación y recarga', async () => {
    signIn();
    const calls = mockFetch((url, init) =>
      init.method === 'POST'
        ? jsonResponse(201, { ...URL_ITEM, id: 2, code: 'nuevo', shortUrl: 'http://localhost:3000/nuevo' })
        : dashboardOk(url, init),
    );
    renderApp('/dashboard');
    await screen.findByRole('table');
    await userEvent.type(screen.getByLabelText('URL a acortar'), 'https://example.com/');
    await userEvent.type(screen.getByLabelText(/Alias/), 'nuevo');
    await userEvent.click(screen.getByRole('button', { name: 'Acortar' }));

    expect(await screen.findByRole('status')).toHaveTextContent('http://localhost:3000/nuevo');
    const post = calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(post.init.body as string)).toEqual({ url: 'https://example.com/', alias: 'nuevo' });
    expect(screen.getByLabelText('URL a acortar')).toHaveValue('');
  });

  it('sin alias no envía el campo alias', async () => {
    signIn();
    const calls = mockFetch((url, init) =>
      init.method === 'POST' ? jsonResponse(201, { ...URL_ITEM, id: 3 }) : dashboardOk(url, init),
    );
    renderApp('/dashboard');
    await screen.findByRole('table');
    await userEvent.type(screen.getByLabelText('URL a acortar'), 'https://example.com/');
    await userEvent.click(screen.getByRole('button', { name: 'Acortar' }));
    await screen.findByRole('status');
    const post = calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(post.init.body as string)).toEqual({ url: 'https://example.com/' });
  });

  it('lista vacía muestra un mensaje en vez de una tabla', async () => {
    signIn();
    mockFetch((url, init) => (url === '/api/urls' ? jsonResponse(200, []) : dashboardOk(url, init)));
    renderApp('/dashboard');
    expect(await screen.findByText(/Aún no tienes enlaces/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
