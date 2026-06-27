from fastapi import HTTPException, status


class NotFound(HTTPException):
    def __init__(self, entity: str):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=f"{entity} not found")


class Forbidden(HTTPException):
    def __init__(self, reason: str = "Access denied"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=reason)


class Conflict(HTTPException):
    def __init__(self, reason: str = "Conflict"):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=reason)


class BadRequest(HTTPException):
    def __init__(self, reason: str):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=reason)
