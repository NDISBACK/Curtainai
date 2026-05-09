"""
Lazy pagination helpers for list endpoints.

Both sync and async paginators accept a ``fetcher`` callable and yield
parsed model instances one at a time, transparently fetching the next page
as needed.

Sync usage::

    for skill in client.skills.iter(status="active"):
        print(skill.name)

    # Process one full page at a time
    for page in client.skills.iter(status="active").pages():
        bulk_index(page)

Async usage::

    async for skill in client.skills.iter(status="active"):
        print(skill.name)
"""
from __future__ import annotations

from typing import (
    Any,
    AsyncIterator,
    Callable,
    Coroutine,
    Generic,
    Iterator,
    List,
    Type,
    TypeVar,
)

from pydantic import TypeAdapter

T = TypeVar("T")


class _PageResponse:
    """Thin wrapper around a raw paginated server response."""

    __slots__ = ("items_raw", "total", "page", "limit")

    def __init__(
        self,
        items_raw: List[Any],
        total: int,
        page: int,
        limit: int,
    ) -> None:
        self.items_raw = items_raw
        self.total = total
        self.page = page
        self.limit = limit

    @property
    def has_next(self) -> bool:
        return self.page * self.limit < self.total


# Type alias for the raw page-fetch callables
_SyncFetcher = Callable[[int, int], _PageResponse]
_AsyncFetcher = Callable[[int, int], Coroutine[Any, Any, _PageResponse]]


class SyncPaginator(Generic[T]):
    """
    Iterates all pages of a list endpoint, yielding one model at a time.

    :param fetcher: ``(page: int, limit: int) -> _PageResponse``
    :param model:   Pydantic model class to parse each raw item into.
    :param limit:   Items per page (1–100, server cap is 100).
    """

    def __init__(
        self,
        fetcher: _SyncFetcher,
        model: Type[T],
        limit: int = 20,
    ) -> None:
        self._fetcher = fetcher
        self._adapter: TypeAdapter[T] = TypeAdapter(model)
        self._limit = min(limit, 100)

    def __iter__(self) -> Iterator[T]:
        page = 1
        while True:
            result = self._fetcher(page, self._limit)
            for raw in result.items_raw:
                yield self._adapter.validate_python(raw)
            if not result.has_next:
                break
            page += 1

    def pages(self) -> Iterator[List[T]]:
        """Yield one full page (``List[T]``) at a time."""
        page = 1
        while True:
            result = self._fetcher(page, self._limit)
            yield [self._adapter.validate_python(r) for r in result.items_raw]
            if not result.has_next:
                break
            page += 1


class AsyncPaginator(Generic[T]):
    """Async equivalent of :class:`SyncPaginator`."""

    def __init__(
        self,
        fetcher: _AsyncFetcher,
        model: Type[T],
        limit: int = 20,
    ) -> None:
        self._fetcher = fetcher
        self._adapter: TypeAdapter[T] = TypeAdapter(model)
        self._limit = min(limit, 100)

    async def __aiter__(self) -> AsyncIterator[T]:
        page = 1
        while True:
            result = await self._fetcher(page, self._limit)
            for raw in result.items_raw:
                yield self._adapter.validate_python(raw)
            if not result.has_next:
                break
            page += 1

    async def apages(self) -> AsyncIterator[List[T]]:
        """Yield one full page (``List[T]``) at a time."""
        page = 1
        while True:
            result = await self._fetcher(page, self._limit)
            yield [self._adapter.validate_python(r) for r in result.items_raw]
            if not result.has_next:
                break
            page += 1
