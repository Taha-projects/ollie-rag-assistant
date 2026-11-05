import asyncio
asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
async def main():
    print('before listen', flush=True)
    try:
        server = await asyncio.wait_for(asyncio.start_server(lambda r, w: None, '127.0.0.1', 8000), 3)
        print('listener ready', flush=True)
        server.close()
        await server.wait_closed()
    except Exception as exc:
        print('listener error:', repr(exc), flush=True)
asyncio.run(main())
