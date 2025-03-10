import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  pt: {
    translation: {
      'login.title': 'Bem-vindo ao IPTV Pro',
      'login.subtitle': 'Acesse milhares de canais, filmes e séries',
      'login.server': 'Selecione o servidor',
      'login.username': 'Usuário',
      'login.username_placeholder': 'Digite seu usuário',
      'login.password': 'Senha',
      'login.password_placeholder': 'Digite sua senha',
      'login.submit': 'Entrar',
      'login.error': 'Erro ao fazer login. Verifique suas credenciais.',
      'login.footer': '© 2024 IPTV Pro. Todos os direitos reservados.',
      'nav.live': 'Canais ao Vivo',
      'nav.movies': 'Filmes',
      'nav.series': 'Séries',
      'nav.settings': 'Configurações',
      'nav.logout': 'Sair',
      'settings.language': 'Idioma',
      'settings.server': 'Servidor',
      'settings.data': 'Gerenciamento de Dados',
      'settings.clear_data': 'Limpar Todos os Dados',
      'settings.clear_confirm': 'Tem certeza que deseja limpar todos os dados? Esta ação não pode ser desfeita.',
      'settings.reset_db': 'Redefinir Banco de Dados',
      'settings.reset_db_confirm': 'Tem certeza que deseja redefinir o banco de dados? Isso irá apagar todos os dados e reiniciar o aplicativo.',
      'settings.reset_db_help': 'Use esta opção apenas se estiver enfrentando problemas com o banco de dados.',
      'settings.troubleshooting': 'Solução de Problemas',
      'channel.no_program': 'Sem programação',
      'channel.watch_now': 'Assistir Agora',
      'channel.select_to_watch': 'Selecione um canal para assistir',
      'search.placeholder': 'Pesquisar...',
      'movies.coming_soon': 'Em breve! Estamos trabalhando para trazer os melhores filmes para você.',
      'movies.title': 'Filmes',
      'movies.empty': 'Nenhum filme encontrado',
      'movies.select_category': 'Selecione uma categoria para ver os filmes',
      'movies.select_to_watch': 'Selecione um filme para assistir',
      'series.coming_soon': 'Em breve! Estamos trabalhando para trazer as melhores séries para você.',
      'series.title': 'Séries',
      'series.empty': 'Nenhuma série encontrada',
      'series.select_category': 'Selecione uma categoria para ver as séries',
      'series.select_to_watch': 'Selecione uma série para assistir',
      'categories.title': 'Categorias',
      'channels.title': 'Canais',
      'channels.empty': 'Nenhum canal encontrado',
      'channels.select_category': 'Selecione uma categoria para ver os canais',
      'error.title': 'Erro ao carregar dados',
      'error.retry': 'Tentar novamente',
      // EPG Popup Translations
      'epg.title': 'Guia de Programação (EPG)',
      'epg.download_title': 'Baixar Guia de Programação',
      'epg.download_description': 'Para visualizar a programação dos canais, é necessário baixar o guia de programação (EPG). Este processo pode levar alguns segundos.',
      'epg.success': 'EPG baixado com sucesso! Agora você pode visualizar a programação dos canais.',
      'epg.error': 'Erro ao baixar o EPG. Tente novamente.',
      'epg.default_error': 'Não foi possível baixar o EPG. Tente novamente mais tarde.',
      'epg.skip': 'Pular',
      'epg.download': 'Baixar EPG',
      'epg.downloading': 'Baixando...',
      'epg.completed': 'Concluído'
    }
  },
  en: {
    translation: {
      'login.title': 'Welcome to IPTV Pro',
      'login.subtitle': 'Access thousands of channels, movies and series',
      'login.server': 'Select server',
      'login.username': 'Username',
      'login.username_placeholder': 'Enter your username',
      'login.password': 'Password',
      'login.password_placeholder': 'Enter your password',
      'login.submit': 'Login',
      'login.error': 'Login failed. Please check your credentials.',
      'login.footer': '© 2024 IPTV Pro. All rights reserved.',
      'nav.live': 'Live TV',
      'nav.movies': 'Movies',
      'nav.series': 'TV Shows',
      'nav.settings': 'Settings',
      'nav.logout': 'Logout',
      'settings.language': 'Language',
      'settings.server': 'Server',
      'settings.data': 'Data Management',
      'settings.clear_data': 'Clear All Data',
      'settings.clear_confirm': 'Are you sure you want to clear all data? This action cannot be undone.',
      'settings.reset_db': 'Reset Database',
      'settings.reset_db_confirm': 'Are you sure you want to reset the database? This will delete all data and restart the application.',
      'settings.reset_db_help': 'Use this option only if you are experiencing problems with the database.',
      'settings.troubleshooting': 'Troubleshooting',
      'channel.no_program': 'No program information',
      'channel.watch_now': 'Watch Now',
      'channel.select_to_watch': 'Select a channel to watch',
      'search.placeholder': 'Search...',
      'movies.coming_soon': 'Coming soon! We are working to bring the best movies to you.',
      'movies.title': 'Movies',
      'movies.empty': 'No movies found',
      'movies.select_category': 'Select a category to view movies',
      'movies.select_to_watch': 'Select a movie to watch',
      'series.coming_soon': 'Coming soon! We are working to bring the best TV shows to you.',
      'series.title': 'TV Shows',
      'series.empty': 'No TV shows found',
      'series.select_category': 'Select a category to view TV shows',
      'series.select_to_watch': 'Select a TV show to watch',
      'categories.title': 'Categories',
      'channels.title': 'Channels',
      'channels.empty': 'No channels found',
      'channels.select_category': 'Select a category to view channels',
      'error.title': 'Error loading data',
      'error.retry': 'Try again',
      // EPG Popup Translations
      'epg.title': 'Program Guide (EPG)',
      'epg.download_title': 'Download Program Guide',
      'epg.download_description': 'To view channel programming, you need to download the Electronic Program Guide (EPG). This process may take a few seconds.',
      'epg.success': 'EPG downloaded successfully! Now you can view channel programming.',
      'epg.error': 'Error downloading EPG. Please try again.',
      'epg.default_error': 'Could not download EPG. Please try again later.',
      'epg.skip': 'Skip',
      'epg.download': 'Download EPG',
      'epg.downloading': 'Downloading...',
      'epg.completed': 'Completed'
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'pt',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;