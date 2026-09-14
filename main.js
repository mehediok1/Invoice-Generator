const { Actor } = require('apify');
const { CheerioCrawler } = require('crawlee');

Actor.main(async () => {
    const input = await Actor.getInput();

    const {
        startUrls = [
            {
                url: 'https://zoneoftools.com/tools/invoice-generator'
            }
        ],
        maxCrawlPages = 1,
        includeImages = true,
        includeLinks = true
    } = input;

    if (!startUrls.length) {
        throw new Error('Please provide at least one URL.');
    }

    const crawler = new CheerioCrawler({
        maxRequestsPerCrawl: maxCrawlPages,

        async requestHandler({ request, $, log }) {
            log.info(`Crawling: ${request.url}`);

            const finalUrl = request.loadedUrl || request.url;

            const title = $('title')
                .first()
                .text()
                .trim();

            const metaDescription =
                $('meta[name="description"]')
                    .attr('content')
                    ?.trim() || '';

            const canonicalUrl =
                $('link[rel="canonical"]')
                    .attr('href')
                    ?.trim() || '';

            const language =
                $('html')
                    .attr('lang')
                    ?.trim() || '';

            const h1 = $('h1')
                .first()
                .text()
                .replace(/\s+/g, ' ')
                .trim();

            const headings = [];

            $('h1, h2, h3, h4, h5, h6').each((index, element) => {
                const tag =
                    $(element)
                        .prop('tagName')
                        ?.toLowerCase() || '';

                const text = $(element)
                    .text()
                    .replace(/\s+/g, ' ')
                    .trim();

                if (text) {
                    headings.push({
                        level: tag,
                        text
                    });
                }
            });

            const contentRoot = $('body').clone();

            contentRoot.find(
                'script, style, noscript, iframe, svg, canvas, nav, footer, header, form'
            ).remove();

            const content = contentRoot
                .text()
                .replace(/\s+/g, ' ')
                .trim();

            const wordCount = content
                ? content.split(/\s+/).filter(Boolean).length
                : 0;

            const images = [];

            if (includeImages) {
                $('img').each((index, element) => {
                    const src = $(element).attr('src');
                    const alt = $(element).attr('alt') || '';

                    if (src) {
                        try {
                            const absoluteUrl = new URL(
                                src,
                                finalUrl
                            ).href;

                            images.push({
                                url: absoluteUrl,
                                alt: alt.trim()
                            });
                        } catch {}
                    }
                });
            }

            const internalLinks = [];
            const externalLinks = [];

            if (includeLinks) {
                let baseHostname = '';

                try {
                    baseHostname = new URL(finalUrl).hostname;
                } catch {
                    baseHostname = '';
                }

                $('a[href]').each((index, element) => {
                    const href = $(element).attr('href');

                    if (!href) return;

                    try {
                        const absoluteUrl = new URL(
                            href,
                            finalUrl
                        ).href;

                        const linkHostname =
                            new URL(absoluteUrl).hostname;

                        if (linkHostname === baseHostname) {
                            internalLinks.push(absoluteUrl);
                        } else {
                            externalLinks.push(absoluteUrl);
                        }
                    } catch {}
                });
            }

            const uniqueInternalLinks = [
                ...new Set(internalLinks)
            ];

            const uniqueExternalLinks = [
                ...new Set(externalLinks)
            ];

            const uniqueImages = Array.from(
                new Map(
                    images.map((image) => [
                        image.url,
                        image
                    ])
                ).values()
            );

            const result = {
                url: finalUrl,
                title,
                metaDescription,
                canonicalUrl,
                h1,
                headings,
                content,
                wordCount,
                images: uniqueImages,
                internalLinks: uniqueInternalLinks,
                externalLinks: uniqueExternalLinks,
                language,
                scrapedAt: new Date().toISOString()
            };

            await Actor.pushData(result);

            log.info(
                `Successfully extracted ${wordCount} words from ${finalUrl}`
            );
        },

        async failedRequestHandler({ request, log }) {
            log.error(
                `Request failed: ${request.url}`
            );
        }
    });

    await crawler.addRequests(
        startUrls.map((item) => ({
            url: item.url
        }))
    );

    await crawler.run();

    console.log(
        'QR Code Generator Actor finished successfully.'
    );
});
