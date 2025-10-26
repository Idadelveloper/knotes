import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Knotes',
        short_name: 'Knotes',
        description: 'A clever fusion of study notes and music notes. Get AI-powered explanations, focus music, and turn your learning into rhythm.',
        start_url: '/',
        display: 'standalone',
        background_color: '#F5F8FB',
        theme_color: '#A5D8FF',
        icons: [
            {
                src: '/icon-192x192.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/icon-512x512.png',
                sizes: '512x512',
                type: 'image/png',
            },
        ],
    }
}